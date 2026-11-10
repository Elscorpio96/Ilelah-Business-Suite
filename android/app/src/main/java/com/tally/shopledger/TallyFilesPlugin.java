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

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * "Save to phone": opens Android's own file picker so the user chooses the folder and file name.
 *
 * Two steps, on purpose. Capacitor keeps the data of the call that opened the picker inside Android's saved
 * state; a big backup there makes the phone throw TransactionTooLargeException and closes the app the moment
 * the picker appears. So the backup is first written to a private temp file (stage), and the call that opens
 * the picker carries only the file name. When the person has picked a place, the temp file is copied there.
 */
@CapacitorPlugin(name = "TallyFiles")
public class TallyFilesPlugin extends Plugin {

    private File stageFile() {
        return new File(getContext().getCacheDir(), "tally-backup-stage.tmp");
    }

    @PluginMethod
    public void stage(final PluginCall call) {
        final String data = call.getString("data", "");
        final boolean isBase64 = Boolean.TRUE.equals(call.getBoolean("base64", false));
        new Thread(() -> {
            try {
                FileOutputStream os = new FileOutputStream(stageFile(), false);
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
                ok.put("bytes", stageFile().length());
                call.resolve(ok);
            } catch (Throwable e) {
                call.reject("Could not prepare the file: " + e.getMessage());
            }
        }, "tally-stage").start();
    }

    @PluginMethod
    public void save(PluginCall call) {
        if (!stageFile().exists()) {
            call.reject("Nothing to save.");
            return;
        }
        String filename = call.getString("filename", "backup.json");
        String mime = call.getString("mime", "application/octet-stream");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(final PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject out = new JSObject();
            out.put("saved", false);
            call.resolve(out);
            return;
        }
        final Uri uri = result.getData().getData();
        new Thread(() -> {
            try {
                OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt");
                if (os == null) {
                    call.reject("Could not open the file.");
                    return;
                }
                try {
                    InputStream in = new FileInputStream(stageFile());
                    try {
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                    } finally {
                        in.close();
                    }
                    os.flush();
                } finally {
                    try { os.close(); } catch (Exception ignore) { }
                }
                try { stageFile().delete(); } catch (Exception ignore) { }
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
