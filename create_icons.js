const fs = require('fs');
const { execSync } = require('child_process');

// Use sips to resize and crop
try {
  execSync('sips -Z 512 public/assets/logo_giadinhhaha.jpg --out public/assets/temp.png');
  execSync('sips -c 512 512 public/assets/temp.png --out public/assets/icon-512.png');
  execSync('sips -z 192 192 public/assets/icon-512.png --out public/assets/icon-192.png');
  fs.unlinkSync('public/assets/temp.png');
  console.log('Icons created');
} catch (e) {
  console.error('Error creating icons', e);
}
