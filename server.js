const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Define the uploads directory
const uploadsDir = path.join(__dirname, 'uploads');

// Serve static files (images) from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname)));

// Serve the HTML form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/', (req, res) => {
    res.send('Hello from Vercel!');
  });

app.get('/api/resize', (req, res) => {
    res.json({ message: 'Image resize API' });
  });
  
// Set up storage for uploaded images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Function to apply a watermark
const applyWatermark = async (inputPath, outputPath, text) => {
    const watermark = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40">
            <text x="0" y="20" font-size="20" fill="white" opacity="0.5">${text}</text>
        </svg>`
    );

    await sharp(inputPath)
        .composite([{ input: watermark, gravity: 'southeast' }])
        .toFile(outputPath);
};

// API to upload and resize an image
app.post('/upload', upload.single('image'), async (req, res) => {
    const width = parseInt(req.query.width) || null;
    const height = parseInt(req.query.height) || null;

    try {
        const outputFilePath = path.join(uploadsDir, `resized-${req.file.filename}`);

        const metadata = await sharp(req.file.path).metadata();

        let newWidth = width;
        let newHeight = height;

        if (width && !height) {
            newHeight = Math.round((metadata.height * width) / metadata.width);
        } else if (!width && height) {
            newWidth = Math.round((metadata.width * height) / metadata.height);
        } else if (!width && !height) {
            newWidth = metadata.width;
            newHeight = metadata.height;
        }

        await sharp(req.file.path)
            .resize({ width: newWidth, height: newHeight })
            .toFile(outputFilePath);

        const watermarkText = "©Tess.co";
        const watermarkedFilePath = path.join(uploadsDir, `watermarked-${req.file.filename}`);

        await applyWatermark(outputFilePath, watermarkedFilePath, watermarkText);

        fs.unlink(req.file.path, (err) => {
            if (err) console.error(`Error deleting original file: ${err}`);
        });

        res.json({
            message: "Image uploaded, resized, and watermarked successfully",
            filename: `watermarked-${req.file.filename}`
        });
    } catch (error) {
        console.error("Error processing image:", error);
        res.status(500).send(`Error processing image: ${error.message}`);
    }
});


// Download API to download the resized and watermarked image
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.log("Error in downloading file:", err);
                res.status(500).send("Error downloading file");
            }
        });
    } else {
        res.status(404).send("File not found");
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
