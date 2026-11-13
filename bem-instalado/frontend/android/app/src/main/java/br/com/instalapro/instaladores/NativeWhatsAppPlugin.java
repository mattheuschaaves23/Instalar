package br.com.instalapro.instaladores;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeWhatsApp")
public class NativeWhatsAppPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        Uri link = Uri.parse(call.getString("url", ""));
        String phone = link.getLastPathSegment();
        if (!"https".equals(link.getScheme()) || !"wa.me".equals(link.getHost())
                || phone == null || !phone.matches("[0-9]{10,15}")) {
            call.reject("Link do WhatsApp inválido.");
            return;
        }

        Uri chat = new Uri.Builder().scheme("whatsapp").authority("send")
                .appendQueryParameter("phone", phone)
                .appendQueryParameter("text", link.getQueryParameter("text"))
                .build();
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, chat));
            call.resolve();
        } catch (ActivityNotFoundException error) {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, link));
                call.resolve();
            } catch (ActivityNotFoundException unavailable) {
                call.reject("WhatsApp indisponível neste dispositivo.");
            }
        }
    }
}
