// ============================================================================
//  SDS PRO - BORDEREAU DE VERSEMENT PARTENAIRE (PDF telechargeable)
//
//  Genere un bordereau officiel SDS PRO avec le decompte complet d'un
//  versement : montant vente, commission SDS, frais service, livraison,
//  net verse. Porte le cachet SDS PRO.
//
//  APPEL :
//    genererBordereauVersement({
//      boutique: { nom, proprietaire, telephone, ville, payout_operateur, payout_numero },
//      versement: { ref, date, produit, commande, montant_vente, commission_pct,
//                   commission, frais_service, livraison, net }
//    });
//
//  PREREQUIS : jsPDF charge + cachet-sds-pro.png a la racine du site.
// ============================================================================

const CACHET_URL_VERS = '/cachet-sds-pro.png';

async function _imgVers(url){
  try{
    const r = await fetch(url); if(!r.ok) return null;
    const b = await r.blob();
    return await new Promise(res=>{ const f=new FileReader(); f.onload=()=>res(f.result); f.onerror=()=>res(null); f.readAsDataURL(b); });
  }catch(e){ return null; }
}
function _fmtV(n){ return Number(n||0).toLocaleString('fr-FR').replace(/[\s\u202f\u00a0]/g,' '); }

async function genererBordereauVersement(data){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W=210, H=297;
  const b=data.boutique||{}, v=data.versement||{};

  // En-tete SDS PRO
  doc.setFillColor(1,9,18); doc.rect(0,0,W,48,'F');
  doc.setTextColor(0,200,255); doc.setFont('helvetica','bold'); doc.setFontSize(17);
  doc.text('SECK DIGITAL SERVICES PRO', 20, 20);
  doc.setTextColor(189,212,234); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  doc.text('NINEA 013038395  -  RCCM SN DKR 2026 A 16899', 20, 26);
  doc.text('Tel : 77 069 97 39  -  sdsprotech.com', 20, 31);
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(15);
  doc.text('BORDEREAU DE VERSEMENT', W-20, 40, {align:'right'});
  doc.setTextColor(150,180,210); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(`N° ${v.ref||''}   -   ${v.date||new Date().toLocaleDateString('fr-FR')}`, 20, 40);

  // Destinataire
  let y=62;
  doc.setTextColor(120,140,165); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('VERSEMENT A', 20, y);
  doc.setTextColor(20,25,35); doc.setFont('helvetica','normal'); doc.setFontSize(12);
  doc.text(b.nom||'Boutique', 20, y+6);
  doc.setFontSize(9); doc.setTextColor(90,100,120);
  doc.text([b.proprietaire,b.ville,b.telephone].filter(Boolean).join('  -  '), 20, y+11);
  if(b.payout_numero) doc.text(`Vers ${b.payout_operateur||'mobile money'} : ${b.payout_numero}`, 20, y+16);
  doc.setTextColor(120,140,165);
  if(v.commande) doc.text(`Commande : ${v.commande}`, W-20, y+6, {align:'right'});
  if(v.produit)  doc.text(`Produit : ${v.produit}`, W-20, y+11, {align:'right'});

  // Tableau decompte
  y=94;
  doc.setFillColor(237,242,248); doc.rect(20,y,W-40,9,'F');
  doc.setTextColor(120,140,165); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
  doc.text('DÉCOMPTE', 24, y+6); doc.text('MONTANT', W-24, y+6, {align:'right'});

  function ligne(label, montant, rouge, signe){
    y+=8;
    doc.setTextColor(rouge?230:20, rouge?60:25, rouge?70:35);
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text(label, 24, y+4);
    doc.text(`${signe||''}${_fmtV(montant)} F`, W-24, y+4, {align:'right'});
    doc.setDrawColor(230,235,240); doc.setLineWidth(0.3); doc.line(20, y+6, W-20, y+6);
  }
  ligne('Montant de la vente', v.montant_vente, false, '');
  ligne(`Commission SDS PRO (${v.commission_pct||0}%)`, v.commission, true, '- ');
  if(v.frais_service) ligne('Frais de service', v.frais_service, true, '- ');
  if(v.livraison) ligne('Frais de livraison', v.livraison, true, '- ');

  // Net verse
  y+=16;
  doc.setFillColor(1,9,18); doc.rect(W-100, y, 80, 11, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('NET VERSÉ', W-96, y+7);
  doc.setTextColor(0,225,115); doc.setFontSize(14);
  doc.text(`${_fmtV(v.net)} F`, W-24, y+7.5, {align:'right'});

  // Cachet
  const cachet = await _imgVers(CACHET_URL_VERS);
  if(cachet){ try{ doc.addImage(cachet,'PNG',20,H-62,34,34); }catch(e){} }

  // Pied
  doc.setDrawColor(217,224,232); doc.setLineWidth(0.3); doc.line(20,H-26,W-20,H-26);
  doc.setTextColor(100,110,130); doc.setFont('helvetica','italic'); doc.setFontSize(8);
  doc.text('Ce bordereau atteste du versement effectué par SECK DIGITAL SERVICES PRO au partenaire ci-dessus.', W/2, H-20, {align:'center'});
  doc.text('Document généré automatiquement, valable sans signature manuscrite.', W/2, H-16, {align:'center'});

  doc.save(`bordereau-${v.ref||Date.now()}.pdf`);
}

window.genererBordereauVersement = genererBordereauVersement;
