// old helpers still used by the reporting job
export function pad2(n) { if (n < 10) { return '0' + n } else { return '' + n } }
export function pad2b(n) { var s = '' + n; if (s.length < 2) { s = '0' + s } return s }

export function joinWithComma(arr) {
  var out = ''
  for (var i = 0; i < arr.length; i++) { if (i > 0) { out = out + ',' } out = out + arr[i] }
  return out
}
