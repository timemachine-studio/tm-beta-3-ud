// Cloudinary upload service for handling image uploads

/**
 * Uploads a base64 image to Cloudinary and returns a publicly accessible URL
 * @param base64Image - The base64 encoded image data
 * @returns Promise with the public URL of the uploaded image
 */
export async function uploadImageToCloudinary(base64Image: string): Promise<string> {
  try {
    // Remove the data URL prefix if present
    const base64Data = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;
    
    // Prepare the form data for Cloudinary upload
    const formData = new FormData();
    formData.append('file', `data:image/png;base64,${base64Data}`);
    formData.append('upload_preset', 'timemachine_uploads'); // You'll need to create this preset in Cloudinary
    
    // Upload to Cloudinary - Replace YOUR_CLOUD_NAME with your actual Cloudinary cloud name
    const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Return the secure URL with .png extension to ensure compatibility with Pollinations
    return `${data.secure_url.split('.').slice(0, -1).join('.')}.png`;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}