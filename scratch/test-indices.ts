async function test() {
  try {
    const kospiRes = await fetch('https://m.stock.naver.com/api/index/KOSPI/price?pageSize=1&page=1');
    const kospiData = await kospiRes.json();
    console.log('KOSPI Data:', JSON.stringify(kospiData, null, 2));

    const kosdaqRes = await fetch('https://m.stock.naver.com/api/index/KOSDAQ/price?pageSize=1&page=1');
    const kosdaqData = await kosdaqRes.json();
    console.log('KOSDAQ Data:', JSON.stringify(kosdaqData, null, 2));
  } catch (err) {
    console.error('Error fetching indices:', err);
  }
}
test();
