// Parser de arquivos OFX (Open Financial Exchange) — extratos bancários e de cartão.
// Suporta OFX1 (SGML) e OFX2 (XML) via leitura de tags.
export function parseOfx(text) {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const getTag = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
    return m ? m[1].trim() : '';
  };

  const transactions = blocks.map(b => {
    const dateRaw = getTag(b, 'DTPOSTED');
    let date = '';
    if (dateRaw.length >= 8) {
      date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
    }
    const amount = parseFloat(getTag(b, 'TRNAMT').replace(',', '.')) || 0;
    const name = getTag(b, 'NAME');
    const memo = getTag(b, 'MEMO');
    const fitid = getTag(b, 'FITID');
    const description = [name, memo].filter(Boolean).join(' - ');
    return { date, amount, fitid, description, name, memo };
  });

  const isCard = /<CCSTMT>|<CCACCTFROM>|<CCSTMTRS>/i.test(text);
  return { source: isCard ? 'cartao' : 'banco', transactions };
}