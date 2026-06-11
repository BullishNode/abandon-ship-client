export function canUseCamera(): boolean {
  return typeof navigator?.mediaDevices?.getUserMedia === 'function'
}
