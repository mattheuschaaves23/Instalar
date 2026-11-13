package br.com.instalapro.instaladores;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeWhatsAppPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
