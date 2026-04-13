const fs = require("fs");
console.log("Script running...");
// Will be overwritten by actual content
fs.writeFileSync("test/_test_marker.txt", "marker");
