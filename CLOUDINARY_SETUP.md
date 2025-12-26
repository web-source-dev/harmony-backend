# Cloudinary Image Upload Setup

This guide will help you upload all images from the `backend/assets` folder to Cloudinary and update the image URLs in the JSON files.

## Prerequisites

1. Create a free Cloudinary account at https://cloudinary.com/
2. Install dependencies: `npm install`

## Setup

1. **Get your Cloudinary credentials:**
   - Go to https://cloudinary.com/console
   - Note your Cloud Name, API Key, and API Secret

2. **Create a `.env` file in the backend directory:**
   ```bash
   CLOUDINARY_CLOUD_NAME=your_cloud_name_here
   CLOUDINARY_API_KEY=your_api_key_here
   CLOUDINARY_API_SECRET=your_api_secret_here
   ```

3. **Ensure your images are in the correct location:**
   - All images should be in `backend/assets/` folder
   - Supported formats: .jpg, .jpeg, .png, .gif, .webp, .avif

## Usage

Run the upload script:

```bash
npm run upload-images
```

or

```bash
node scripts/upload-images-to-cloudinary.js
```

## What the script does:

1. **Scans** all image files in `backend/assets/`
2. **Uploads** each image to Cloudinary in the `harmony4all/assets` folder
3. **Updates** both `backend/image-urls.json` and `frontend/app/image-urls.json` with new Cloudinary URLs
4. **Maintains** the existing JSON structure while updating `cloudinaryUrl` fields

## File naming:

- The script removes `-min` suffixes from filenames when creating Cloudinary public IDs
- Example: `image-min.jpg` becomes public ID `image`

## Troubleshooting:

- **Missing credentials**: Ensure all CLOUDINARY_* environment variables are set
- **Upload failures**: Check your internet connection and Cloudinary account limits
- **File not found**: Ensure images exist in `backend/assets/` directory

## Cost considerations:

- Cloudinary has a generous free tier (25GB storage, 25GB monthly bandwidth)
- Each image upload counts toward your monthly usage
- The script uploads all images found in the assets folder
