const fs = require('fs');
const glob = require('glob'); // Or just simple recursive walk if glob not available.
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

function processFiles() {
  const exts = ['.tsx', '.ts', '.css', '.html', '.json', '.sql', '.js'];
  
  walkDir('.', (filePath) => {
    if (filePath.includes('node_modules') || filePath.includes('.next') || filePath.includes('.git')) return;
    if (!exts.some(ext => filePath.endsWith(ext))) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace hex colors
    content = content.replace(/#2563eb/g, '#2563eb');
    
    // Replace classList logic to use dark instead of light
    content = content.replace(/classList\.toggle\('light',\s*(saved|next)\s*===\s*'light'\)/g, "classList.toggle('dark', $1 === 'dark')");
    content = content.replace(/classList\.add\('light'\)/g, "classList.remove('dark')");

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log('Updated', filePath);
    }
  });
}

processFiles();
