/**
 * Test rapide pour voir si Domain Connect est supporté
 */

async function testDomainConnectSupport(domain: string) {
  console.group(`🔍 Test Domain Connect: ${domain}`);

  // 1. Test _domainconnect TXT record
  const txtUrl = `https://cloudflare-dns.com/dns-query?name=_domainconnect.${domain}&type=TXT`;
  const txtResponse = await fetch(txtUrl, {
    headers: { 'Accept': 'application/dns-json' }
  });
  const txtData = await txtResponse.json();

  const hasDomainConnect = txtData.Answer && txtData.Answer.length > 0;

  if (hasDomainConnect) {
    const providerUrl = txtData.Answer[0].data.replace(/"/g, '');
    console.log('✅ Domain Connect SUPPORTÉ!');
    console.log('Provider URL:', providerUrl);
    console.log('→ Configuration automatique POSSIBLE');
  } else {
    console.log('❌ Domain Connect NON supporté');
    console.log('→ Configuration manuelle requise');
  }

  // 2. Test nameservers (détection basique)
  const nsUrl = `https://cloudflare-dns.com/dns-query?name=${domain}&type=NS`;
  const nsResponse = await fetch(nsUrl, {
    headers: { 'Accept': 'application/dns-json' }
  });
  const nsData = await nsResponse.json();

  if (nsData.Answer) {
    const nameservers = nsData.Answer.map((a: any) => a.data);
    console.log('\n📋 Nameservers:', nameservers);
  }

  console.groupEnd();

  return hasDomainConnect;
}

// Test avec quelques domaines connus
console.log('Test 1: Domaine avec Domain Connect (rare)');
await testDomainConnectSupport('example.com');

console.log('\n' + '='.repeat(60) + '\n');

console.log('Test 2: Votre domaine');
await testDomainConnectSupport('VOTRE-DOMAINE.com'); // Remplacer

console.log('\n' + '='.repeat(60) + '\n');

console.log('Test 3: Domaines populaires (probablement sans DC)');
await testDomainConnectSupport('google.com');
await testDomainConnectSupport('github.com');
