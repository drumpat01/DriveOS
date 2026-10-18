declare module "*.csv" {
  const value: string;
  export default value;
}

declare module "*.cer" {
  const value: ArrayBuffer;
  export default value;
}
