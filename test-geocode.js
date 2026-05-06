import fetch from 'node-fetch';
async function test() {
  const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=23.1320&lon=-82.383');
  const data = await res.json();
  console.log('nominatim', data);
  const res2 = await fetch('https://photon.komoot.io/reverse?lon=-82.383&lat=23.1320');
  const data2 = await res2.json();
  console.log('photon', JSON.stringify(data2, null, 2));
}
test();
