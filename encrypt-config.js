const fs = require('fs');
const crypto = require('crypto');

const key = crypto.scryptSync('Org@n!ism0-Jud!ciAl', 'salt', 32); // Usa una clave robusta
const iv = crypto.randomBytes(16); // Initialization vector

const data = fs.readFileSync('config.json');
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

let encrypted = cipher.update(data);
encrypted = Buffer.concat([iv, encrypted, cipher.final()]); // Prepend IV al inicio

fs.writeFileSync('config.enc', encrypted);
console.log('✅ Config encriptado y guardado como config.enc');
