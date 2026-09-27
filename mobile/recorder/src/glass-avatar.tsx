// Lens shader adapted from Appllama/liquid-glass-chat-ui (Astra GlassPortrait),
// Copyright (c) 2026 Appllama, MIT License. See THIRD_PARTY_NOTICES.md.
import { Image, View, type ImageSourcePropType } from 'react-native';
import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from '@shopify/react-native-skia';

// A photograph under a clear convex lens: the perimeter bends the image and
// catches reflected light while the centre stays clean and legible.
const lens = Skia.RuntimeEffect.Make(`
uniform shader photograph;
uniform float size;
half4 main(float2 xy) {
  float2 p = (xy / size - 0.5) * 2.0;
  float r = length(p);
  float aa = 1.0 / size;
  float mask = 1.0 - smoothstep(0.997-aa,0.997+aa,r);
  if (mask < 0.001) return half4(0);
  float z = sqrt(max(0.001,1.0-r*r));
  float3 normal = float3(p,z);
  float bevel = smoothstep(0.70,1.0,r);
  float bend = 1.025 - 0.285*bevel*bevel;
  float2 sampleAt = p*bend;
  float2 split = p*0.006*bevel*bevel;
  half4 red = photograph.eval((sampleAt+split)*size*0.5+size*0.5);
  half4 green = photograph.eval(sampleAt*size*0.5+size*0.5);
  half4 blue = photograph.eval((sampleAt-split)*size*0.5+size*0.5);
  float3 color = float3(red.r,green.g,blue.b);
  float fresnel = 0.035 + 0.965*pow(1.0-z,4.0);
  float side = dot(normal,normalize(float3(-0.68,-0.46,0.48)));
  float env = 0.22 + 0.66*smoothstep(-0.4,0.75,side);
  color = mix(color,float3(env),fresnel*0.80);
  float shoulder = exp(-pow((r-0.93)/0.036,2.0));
  color *= 1.0-shoulder*(0.10+0.16*smoothstep(-0.4,0.6,p.x-p.y));
  float arch = p.y + 0.79 - 0.40*p.x*p.x;
  float crown = exp(-pow(arch/0.10,2.0)-pow((p.x+0.17)/0.70,6.0));
  float broad = exp(-pow((p.x+0.34)/0.48,2.0)-pow((p.y+0.65)/0.29,2.0));
  color = mix(color,float3(0.985,0.99,1.0),crown*0.54+broad*0.12);
  float edgeLight = exp(-pow((r-0.980)/0.006,2.0))
    *pow(max(0.0,dot(p/max(r,0.001),normalize(float2(-0.65,-0.76)))),1.4);
  color = mix(color,float3(1.0),edgeLight*0.62);
  return half4(color*mask,mask);
}`);

/**
 * The JourneyDeck navigator avatar seen through a glass lens. Falls back to
 * the plain round image until the photo decodes, if the shader cannot compile,
 * or when Reduce Transparency asks for plain surfaces.
 */
export function GlassAvatar({ source, size, plain = false, label }: { source: ImageSourcePropType; size: number; plain?: boolean; label?: string }) {
  const photo = useImage(plain ? null : source as number);
  if (plain || !photo || !lens) {
    return <Image accessibilityLabel={label} source={source} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return <View accessible={Boolean(label)} accessibilityLabel={label} style={{ width: size, height: size }}>
    <Canvas pointerEvents="none" style={{ width: size, height: size }}>
      <Fill>
        <Shader source={lens} uniforms={{ size }}>
          <ImageShader image={photo} fit="cover" rect={{ x: 0, y: 0, width: size, height: size }} />
        </Shader>
      </Fill>
    </Canvas>
  </View>;
}
