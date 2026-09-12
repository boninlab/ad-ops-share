export function validatePowerlinkDescription(value: string) {
  const rendered = value.normalize('NFC').trim()
    .replace(/\{(?:keyword|키워드):([^{}]*)\}/gi, '$1')
    .replace(/\{(?:keyword|키워드)\}/gi, '');
  const length = Array.from(rendered).length;
  if (length < 20 || length > 45) {
    throw new Error(`파워링크 설명 문구는 20~45자여야 합니다. 현재 ${length}자입니다. 키워드 삽입은 기본 문구로 계산합니다.`);
  }
}
