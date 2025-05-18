
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Recommended for Netlify and similar platforms
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      // When integrating real image search from services like Unsplash or Pexels,
      // you will need to add their image CDN hostnames here for next/image optimization.
      // For example:
      // {
      //   protocol: 'https',
      //   hostname: 'images.unsplash.com',
      // },
      // {
      //   protocol: 'https',
      //   hostname: 'images.pexels.com',
      // },
    ],
  },
};

export default nextConfig;
