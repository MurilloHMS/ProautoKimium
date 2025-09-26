window.generateCertificate = async function (nome, type) {
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: "mm",
        format: "a4"
    });

    const img = new Image();
    img.src = `assets/certificates/${type}.jpg`;

    await new Promise(resolve => img.onload = resolve);

    doc.addImage(img, "JPEG", 0, 0, 297, 210);
    doc.setFont("lora");
    doc.setFontSize(28);
    doc.setTextColor("#232e61");
    doc.text(nome, 148, 85, {align: 'center'});

    doc.save(`certificado - ${nome}.pdf`);
}