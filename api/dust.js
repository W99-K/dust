// Vercel 서버리스 함수: 한국환경공단 에어코리아 대기오염정보 중계 API
export default async function handler(req, res) {
  // GET 요청만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '허용되지 않는 요청 방식입니다.' });
  }

  // 쿼리스트링에서 시도 이름 추출 (지정되지 않은 경우 기본값 '서울')
  const sido = req.query.sido || '서울';

  // 환경변수에서 공공데이터포털 디코딩 인증키 읽기
  const apiKey = process.env.AIRKOREA_KEY;

  // 환경변수에 인증키가 설정되어 있지 않은 경우 에러 반환
  if (!apiKey) {
    return res.status(500).json({
      message: '서버 환경변수에 AIRKOREA_KEY 가 설정되지 않았습니다. Vercel 환경변수 또는 .env.local 을 확인해주세요.'
    });
  }

  try {
    // 인코딩 키든 디코딩 키든 상관없이 안전하게 원본 디코딩 키 상태로 맞춘 뒤 1번만 encodeURIComponent 처리
    const cleanKey = decodeURIComponent(apiKey.trim());
    const encodedKey = encodeURIComponent(cleanKey);
    // 시도 이름 URL 인코딩 처리
    const encodedSido = encodeURIComponent(sido);

    // 공공데이터포털 에어코리아 실시간 대기오염 측정 정보 API URL 구성
    const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&sidoName=${encodedSido}&numOfRows=100&pageNo=1&ver=1.3`;

    // 공공데이터포털 API 호출
    const response = await fetch(apiUrl);
    // 응답 본문을 텍스트 형태로 읽기 (XML 에러 대응)
    const responseText = await response.text();

    // JSON 파싱 시도 (키 오류나 파라미터 오류 시 XML로 반환될 수 있음)
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseError) {
      // JSON 파싱에 실패하고 XML 에러 메시지가 온 경우 한국어 에러 안내 반환
      return res.status(400).json({
        message: '인증키 또는 요청값을 확인해주세요.',
        errorDetail: '공공데이터포털 응답이 JSON 형식이 아닙니다.'
      });
    }

    // 응답 본문 안의 resultCode 확인 (정상 코드는 '00')
    const header = jsonData?.response?.header;
    const resultCode = header?.resultCode;
    const resultMsg = header?.resultMsg || '알 수 없는 오류';

    // resultCode가 성공('00')이 아닐 때 한국어 메시지 반환
    if (resultCode !== '00') {
      return res.status(400).json({
        message: `공공데이터 API 오류가 발생했습니다 (${resultMsg}). 인증키 또는 요청값을 확인해주세요.`,
        resultCode: resultCode
      });
    }

    // 정상적으로 가져온 대기질 JSON 데이터를 클라이언트에 전달
    return res.status(200).json(jsonData);

  } catch (error) {
    // 네트워크 오류나 서버 예외 발생 시 에러 반환
    return res.status(500).json({
      message: `서버 통신 중 오류가 발생했습니다: ${error.message}`
    });
  }
}

