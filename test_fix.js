
import fs from 'fs';

try {
  const content = fs.readFileSync('public/data/new_krv.txt', 'utf8');
  // If it was interpreted as ISO-8859-1 and saved as UTF-8, 
  // we can get the original bytes by reading as ISO-8859-1 (if possible) 
  // or by converting each character back to its code point.
  
  const buffer = Buffer.from(content, 'binary'); // This might work if node treats 'binary' as ISO-8859-1
  const decoded = new TextDecoder('cp949').decode(buffer);
  
  console.log('Decoded result (CP949):');
  console.log(decoded.substring(0, 100));
} catch (e) {
  console.error(e);
}
