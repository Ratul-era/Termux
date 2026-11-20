/**
 * ============================================================================
 * FREE ZERO-API-KEY GOOGLE DRIVE FOLDER SCANNER (Google Apps Script)
 * ============================================================================
 * Deploy once on your own Google account (100% Free, No API Key Required):
 * 1. Go to https://script.google.com -> Click "New Project"
 * 2. Paste this entire file and Save (Ctrl+S)
 * 3. Click "Deploy" -> "New deployment" -> Type: "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 4. Authorize & Copy the Web App URL (ends with /exec)
 * 5. Paste that URL into your Portfolio Toolbox -> Connect & AI Setup
 * ============================================================================
 */

function doGet(e) {
  try {
    var folderParam = (e && e.parameter && e.parameter.folder) || "";
    var includeSamples = (e && e.parameter && e.parameter.samples === "1");
    var folderId = extractFolderId_(folderParam);
    if (!folderId) {
      return jsonResponse_({ ok: false, error: "Invalid or missing Google Drive folder URL/ID." });
    }

    var rootFolder = DriveApp.getFolderById(folderId);
    var files = [];
    var sampleThumbs = [];
    collectFilesRecursive_(rootFolder, "", files, sampleThumbs, includeSamples, 0);

    return jsonResponse_({
      ok: true,
      folderName: rootFolder.getName(),
      folderId: folderId,
      total: files.length,
      files: files,
      sampleThumbs: sampleThumbs
    });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function extractFolderId_(input) {
  if (!input) return "";
  var m = String(input).match(/folders\/([a-zA-Z0-9_-]+)/i);
  if (m) return m[1];
  var m2 = String(input).match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(String(input).trim())) return String(input).trim();
  return "";
}

function collectFilesRecursive_(folder, pathPrefix, out, sampleThumbs, includeSamples, depth) {
  if (depth > 3) return;
  var fileIter = folder.getFiles();
  while (fileIter.hasNext()) {
    var f = fileIter.next();
    var id = f.getId();
    var name = f.getName();
    var mime = f.getMimeType() || "";
    var ext = name.indexOf(".") > -1 ? name.split(".").pop().toLowerCase() : "";

    var kind = "file3d";
    var url = "https://drive.google.com/file/d/" + id + "/view";
    var thumb = "";

    if (mime.indexOf("image/") === 0 || /^(jpg|jpeg|png|webp|gif|bmp)$/i.test(ext)) {
      kind = "image";
      url = "https://lh3.googleusercontent.com/d/" + id + "=w1600";
      thumb = "https://lh3.googleusercontent.com/d/" + id + "=w800";

      // Capture up to 4 small CORS-free base64 thumbnails for Multimodal AI visual analysis
      if (includeSamples && sampleThumbs.length < 4) {
        try {
          var thumbRes = UrlFetchApp.fetch("https://lh3.googleusercontent.com/d/" + id + "=w512", { muteHttpExceptions: true });
          if (thumbRes.getResponseCode() === 200) {
            var blob = thumbRes.getBlob();
            sampleThumbs.push({
              name: name,
              folderPath: pathPrefix,
              mimeType: blob.getContentType() || "image/jpeg",
              data: Utilities.base64Encode(blob.getBytes())
            });
          }
        } catch (thumbErr) {}
      }
    } else if (mime.indexOf("video/") === 0 || /^(mp4|webm|mov|m4v|mkv|avi)$/i.test(ext)) {
      kind = "drive_video";
      url = "https://drive.google.com/file/d/" + id + "/preview";
      thumb = "https://lh3.googleusercontent.com/d/" + id + "=w800";
    }

    out.push({
      id: id,
      name: name,
      folderPath: pathPrefix,
      mime: mime,
      ext: ext.toUpperCase(),
      type: kind,
      url: url,
      thumb: thumb,
      sizeBytes: f.getSize(),
      updated: f.getLastUpdated().toISOString().slice(0, 10)
    });
  }

  var subIter = folder.getFolders();
  while (subIter.hasNext()) {
    var sub = subIter.next();
    var nextPrefix = pathPrefix ? (pathPrefix + "/" + sub.getName()) : sub.getName();
    collectFilesRecursive_(sub, nextPrefix, out, sampleThumbs, includeSamples, depth + 1);
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
