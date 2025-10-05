const IMAGEBB_API_KEY = 'de84a9bd2c699e89ebb4f2a9bbcda261';
const IMAGEBB_API_URL = 'https://api.imgbb.com/1/upload';

export interface ImageBBResponse {
  success: boolean;
  url: string;
  error?: string;
}

export async function uploadToImageBB(base64Image: string): Promise<ImageBBResponse> {
  try {
    const base64Data = base64Image.split(',')[1];

    const formData = new FormData();
    formData.append('key', IMAGEBB_API_KEY);
    formData.append('image', base64Data);

    const response = await fetch(IMAGEBB_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ImageBB upload failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data && data.data.url) {
      return {
        success: true,
        url: data.data.url,
      };
    } else {
      throw new Error('Invalid response from ImageBB');
    }
  } catch (error) {
    console.error('ImageBB upload error:', error);
    return {
      success: false,
      url: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
