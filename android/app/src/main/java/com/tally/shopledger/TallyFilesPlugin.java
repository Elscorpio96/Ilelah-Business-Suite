package com.tally.shopledger;

import android.app.Activity;
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

import java.io.OutputStream;

/**
 * "Save to phone": opens Android's own file picker so the user chooses the folder
 * (Downloads, Documents, an SD card...) and the file name, and the file is written there.
 * Needs no storage permission.
 */
@CapacitorPlugin(name = "TallyFiles")
public class TallyFilesPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename", "backup.json");
        String mime = call.getString("mime", "application/octet-stream");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            out.put("saved", false);
            call.resolve(out);
            return;
        }
        final Uri uri = result.getData().getData();
        final String data = call.getString("data", "");
        final boolean isBase64 = Boolean.TRUE.equals(call.getBoolean("base64", false));
        // Write off the main thread and in small pieces: a big backup written on the UI thread (or copied into a
        // second huge byte array) can make a phone run out of memory or freeze, which closes the app.
        new Thread(() -> {
            try {
                OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt");
                if (os == null) {
                    call.reject("Could not open the file.");
                    return;
                }
                try {
                    if (isBase64) {
                        os.write(Base64.decode(data, Base64.DEFAULT));
                    } else {
                        java.io.Writer w = new java.io.BufferedWriter(new java.io.OutputStreamWriter(os, "UTF-8"), 65536);
                        final int step = 65536;
                        for (int i = 0; i < data.length(); i += step) {
                            w.write(data, i, Math.min(step, data.length() - i));
                        }
                        w.flush();
                    }
                    os.flush();
                } finally {
                    try { os.close(); } catch (Exception ignore) { }
                }
                JSObject ok = new JSObject();
                ok.put("saved", true);
                ok.put("uri", uri.toString());
                call.resolve(ok);
            } catch (Throwable e) {
                call.reject("Could not save the file: " + e.getMessage());
            }
        }, "tally-save").start();
    }
}
