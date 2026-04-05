import { View, ViewProps } from 'react-native';
import { colors } from '../theme/tokens';

export interface IconProps extends ViewProps {
  size?: number;
  color?: string;
}

export function Icon({ size = 20, color = colors['text-secondary'], style, children, ...props }: IconProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
