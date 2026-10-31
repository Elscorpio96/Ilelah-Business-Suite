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
        Uri uri = result.getData().getData();
        try {
            String data = call.getString("data", "");
            boolean isBase64 = Boolean.TRUE.equals(call.getBoolean("base64", false));
            byte[] bytes = isBase64 ? Base64.decode(data, Base64.DEFAULT) : data.getBytes("UTF-8");
            OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt");
            if (os == null) {
                call.reject("Could not open the file.");
                return;
            }
            try {
                os.write(bytes);
                os.flush();
            } finally {
                os.close();
            }
            out.put("saved", true);
            out.put("uri", uri.toString());
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not save the file: " + e.getMessage());
        }
    }
}
