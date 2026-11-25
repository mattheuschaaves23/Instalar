package br.com.instalapro.instaladores;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeFileExport")
public class NativeFileExportPlugin extends Plugin {
    private static final int MAX_BYTES = 16 * 1024 * 1024;
    private static final int MAX_BASE64 = ((MAX_BYTES + 2) / 3) * 4;
    private boolean pending;

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "");
        String mimeType = call.getString("mimeType", "");
        String data = call.getString("data", "");
        boolean supported = ("application/pdf".equals(mimeType) && name.endsWith(".pdf"))
                || ("application/json".equals(mimeType) && name.endsWith(".json"));

        if (!supported || !name.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,99}") || data.isEmpty() || data.length() > MAX_BASE64) {
            call.reject("Arquivo inválido ou grande demais.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            if (pending) {
                call.reject("Já existe um arquivo sendo salvo.");
                return;
            }
            Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mimeType)
                    .putExtra(Intent.EXTRA_TITLE, name);
            try {
                pending = true;
                startActivityForResult(call, picker, "finishExport");
            } catch (ActivityNotFoundException | IllegalStateException error) {
                pending = false;
                call.reject("Seletor de arquivos indisponível neste aparelho.");
            }
        });
    }

    @ActivityCallback
    private void finishExport(PluginCall call, ActivityResult result) {
        if (call == null) {
            pending = false;
            return;
        }

        Intent response = result.getData();
        Uri destination = response == null ? null : response.getData();
        if (result.getResultCode() != Activity.RESULT_OK) {
            pending = false;
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        if (destination == null || !"content".equals(destination.getScheme())) {
            pending = false;
            call.reject("O destino escolhido está indisponível.");
            return;
        }

        getBridge().execute(() -> {
            try {
                byte[] bytes = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IOException("Invalid export size");
                try (OutputStream out = getContext().getContentResolver().openOutputStream(destination, "w")) {
                    if (out == null) throw new IOException("Destination unavailable");
                    out.write(bytes);
                }
                call.resolve(new JSObject().put("saved", true));
            } catch (IOException | IllegalArgumentException | SecurityException error) {
                call.reject("Não foi possível salvar neste local. Escolha outra pasta e tente novamente.");
            } finally {
                getActivity().runOnUiThread(() -> pending = false);
            }
        });
    }
}
