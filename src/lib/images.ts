import path from 'path';

export function getImagesDir(): string {
  return process.env.IMAGES_DIR ?? path.join(process.cwd(), 'public', 'generated-images');
}
