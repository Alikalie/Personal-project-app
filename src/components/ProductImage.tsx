import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

export function ProductImage({ imageUrl, style }: { imageUrl: string | null; style: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={imageUrl ? { uri: imageUrl } : require('@/assets/images/mishop-icon.png')}
      style={style}
      contentFit={imageUrl ? 'cover' : 'contain'}
      accessibilityLabel={imageUrl ? 'Product image' : 'MiShop product image placeholder'}
    />
  );
}
