function downloadFileFromStream(fileName, fileBase64){
    const link = document.createElement("a");
    link.href = 'data:application/octet-stream;base64,' + fileBase64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadZipFileFromStream(fileName, fileBase64){
    const link = document.createElement("a");
    link.href = 'data:application/zip;base64,' + fileBase64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}