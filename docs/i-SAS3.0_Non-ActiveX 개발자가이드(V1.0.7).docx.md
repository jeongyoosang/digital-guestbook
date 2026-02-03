

| i-SAS 3.0 Non-ActiveX Development Guide |
| :---: |

	

**![C:\\Users\\csback\\Desktop\\bg\_logo\_01.png][image1]**

**문서개정이력**

| 버전 | 개정일자 | 내용 |
| :---: | ----- | ----- |
| 1.0.0 | 2018.04.11 | 최초작성 |
| 1.0.2 | 2020.05.15 | 식별자 확인 API 추가 |
| 1.0.3 | 2020.06.24 | 암호화 함수 내용 변경 |
| 1.0.4 | 2020.07.28 | 모듈 버전 정보 수정 |
| 1.0.5 | 2021.01.07 | 플래시 플레이어 제거 |
| 1.0.6 | 2021.08.31 | 드라이브에 각각 인증서 있을 경우 인증서 위치 명확히 명시 |
| 1.0.7 | 2024.12.24 | 인증서 바이너리 데이터 추가 |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |

**목  차**  
**[1\. i-SAS 3.0 개요](#i-sas-3.0-개요)**	[4](#i-sas-3.0-개요)  
[**1.1**	**목적**	4](#목적)  
[**1.2**	**i-SAS 3.0 지원 환경**	4](#i-sas-3.0-지원-환경)  
[**1.3**	**i-SAS 3.0 업무 흐름도**	4](#i-sas-3.0-업무-흐름도)  
[**1.4**	**모듈 흐름도**	5](#모듈-흐름도)  
[**1.5**	**모듈구성**	5](#모듈구성)  
[**2\. API**	6](#api)  
[**2.1**	**Import 라이브러리**	6](#import-라이브러리)  
[**2.2**	**인증코드 설정**	6](#인증코드-설정)  
[**2.3**	**버전정보 확인**	6](#버전정보-확인)  
[**2.4**	**모듈 강제종료**	7](#모듈-강제종료)  
[**2.5**	**모듈 Update**	7](#모듈-update)  
[**2.6**	**스크래핑 환경변수 설정**	7](#스크래핑-환경변수-설정)  
[**2.7**	**인증서 목록 조회**	8](#heading=h.say7sf5eb026)  
[**2.8**	**인증서** **바이너리 데이터 획득**	9](#heading=h.1k94s9ixzx8z)  
[**2.9**	**인증서** **식별자** **검증**	9](#heading=h.1k94s9ixzx8z)  
[**2.10**	**모듈 초기화**	10](#heading)  
[**2.11**	**Open 및 Thread 할당**	11](#open-및-thread-할당)  
[**2.12**	**입력 데이터 설정 및 실행**	11](#입력-데이터-설정-및-실행)  
[**2.13**	**입력 암호화**	12](#입력-암호화)  
[**2.14**	**결과 복호화**	13](#결과-복호화)

1. **i-SAS 3.0 개요**

i-SAS 3.0 솔루션은 인터넷을 통해 제공되는 정보를 스크래핑하는 솔루션입니다.

1. **목적** 

본 문서는 i-SAS 3.0 개발자를 위한 Web 개발용 개발가이드 입니다.

2. **i-SAS 3.0 지원 환경**

| 데이터포맷 | JSON | 네트워크 | 공용망 |
| :---: | :---- | :---: | :---- |
| **사용언어** | JAVA, JAVASCRIPT (jQuery 1.7 이상) |  |  |
| **지원 OS** | Windows |  |  |
| **지원 브라우저** | IE10 이상, Chrome, Firefox, Opera 등 |  |  |
| **WebService Listen Port** | 14101 | **WebSocket  Listen Port** | 14102 |
| **Domain** | [https://ibasews.coocon.co.kr](https://ibasews.coocon.co.kr)  (로컬 웹서비스) |  |  |
| **SSL** | COMODO RSA Domain Validation Secure Server CA |  |  |

   3. **i-SAS 3.0 업무 흐름도**

1. **모듈 초기화**   
   **: 모듈 초기화 하며, Local Sever를 실행시킵니다.**  
2. WebSocket Connection   
   : PC ( Local Server )  와 Browser 간의 통신을 WebSocket 을 통해 연결합니다.  
3. Message Open 및 Thread 할당  
   : Local Server를 Open 시키며, 동시 작업진행 할 Thread 할당요청 합니다.  
4. Scarping 입력정보 요청   
   : Local Server와 연결된 상태에서 Scraping 요청 데이터를 요청합니다.  
5. Scarping 응답   
   : Scraping 결과를 Callback 함수로 제공합니다.  
6. Scraping 데이터 복호화   
   : Scraping 된 결과를 서버로 전송하여 제공된 라이브러리를 통해 복호화 처리 합니다.  
7. Scraping 데이터 업무처리

   4. **모듈 흐름도**

![][image2]

5. **모듈구성**

| 모듈명 | 설명 |
| ----- | ----- |
| **isas1.0.jar** | **i-SAS 3.0 스크래핑 결과 복호화 라이브러리 \- 프로젝트 라이브러리(jar)에 포함시켜서 사용합니다.** |
| **NXiSAS.exe** | **i-SAS 3.0 설치파일 \- 사용자 PC에 설치하는 스크래핑 설치 모듈입니다.** |

2. **API**

**Web에서 스크래핑 요청 시 함수 기반으로 파라미터를 전달하고 CallBack 형태로 결과를 받는 방식을 사용합니다.**

1. **Import 라이브러리**

Web 페이지에서 i-SAS 3.0호출시 필요로 한 자바스크립트 라이브러리 입니다.

**\[참고1\] 샘플소스**

| \<script src="./js/jquery-1.9.1.min.js"\>\</script\> \<\!— jquery 1.7 이상 권고--\> \<script src="./js/json2.js"\>\</script\> \<script src="./js/web\_socket.js"\>\</script\> \<\!—IE 10이상 지원 \--\> \<script src="./js/isasscaping.js"\>\</script\>  \<link rel="stylesheet" href="./css/process\_manager.css" /\> \<\!—인증서 팝업용 \--\> |
| :---- |

2. **인증코드 설정**

isasscraping.js 파일에 샘플과 같이 발급받은 정보로 설정합니다. 

**\[참고1\] 샘플소스**

| var CooconLicense \= {  "MstCompNo" : "1234567890",    // 고객업체 사업자번호 "SubCompNo" : "1234567890",    // 고객업체 사업자번호 "ProductNo" : "00000014"     // 쿠콘 발급일련번호 }; |
| :---- |

3. **버전정보 확인**

Web 페이지에서 URL정보를 호출하여, 현재설치 되어있는 버전정보를 확인할 수 있습니다..  
[https://ibasews.coocon.co.kr:14101/VERSION](https://ibasews.coocon.co.kr:14101/VERSION)

**\[참고1\] 응답결과**

|  ({"Result":{"Version":"2020.12.15.0"},"ErrorMessage":"","ErrorCode":"00000000"})  |
| :---- |

4. **모듈 강제종료**

Web에서 URL 호출하여, 현재실행중인 WebSocket 모듈을 강제로 종료 시킵니다.  
[https://ibasews.coocon.co.kr:14101/KILL](https://ibasews.coocon.co.kr:14101/KILL) 

**\[참고1\] 응답결과**

|  ({"ErrorMessage":"","ErrorCode":"00000000"}); |
| :---- |

5. **모듈 Update**

Web에서 URL 호출하여, 최신엔진 라이브러리로 업데이트 합니다. 업데이트 호출 시 위 강제종료를 호출을 권장합니다.  
[https://ibasews.coocon.co.kr:14101/update](https://ibasews.coocon.co.kr:14101/update) 

**\[참고1\] 응답결과**

|  ({"ErrorMessage":"","ErrorCode":"00000000"}); |
| :---- |

6. **스크래핑 환경변수 설정**

Isasscraping.js 에 스크래핑 모듈실행 초기값 설정할 수 있습니다. 

| 변수 | 설명 |
| ----- | ----- |
| this.CurrentVersion | **“2020.12.15.0” 버전 이상 일 경우만 허용 합니다.** |
| this.RUNLEVEL | **0: PC 사용자 권한 실행, 1: PC 관리자 권한으로 실행** |

**\[참고1\] 샘플소스**

|  this.CurrentVersion \= "2020.12.15.0"; this.RUNLEVEL \= 1 ;  |
| :---- |

7. **인증서 목록 조회**

해당 PC 설치된 전체 인증서 목록을 조회하여 Callback 으로 결과를 제공합니다.

| 속성 | 설명 |
| ----- | ----- |
| **RDN** | **인증서 식별명** |
| **Drive** | **인증서 저장소 Drive 경로** |
| **Type** | **인증서 타입**  |
| **ExpiryDate** | **인증서 만료일자** |
| **User** | **인증서명** |
| **Issuer** | **발급기관명** |
| **SerialNo** | **인증서 일련번호** |
| **Root** | **인증서 경로** |

**\[참고1\] 샘플소스**

|  CooconiSASNX.getCertList(function(certList){  	console.log(certList); });   |
| :---- |

**\[참고2\] 샘플결과**

| {     "ErrorCode": "00000000",     "ErrorMessage": "",     "Result": {         "CertList": \[             {   "User": "홍길동()001104120201228111000371",   "Issuer": "yessignCA Class 3",   "ExpiryDate": "2024-12-31",   "RDN": "cn=홍길동()001104120201228111000371,ou=NACF,ou=personal4IB,o=yessign,c=kr",   "Type": "은행개인",   "SerialNo": "3237B794",   "Root": "C:\\\\Program Files (x86)\\\\NPKI\\\\yessign\\\\User",   "Drive": "C" } \] } }  |
| :---- |

8. **인증서 바이너리 데이터 획득**

인증서 바이너리 API는 해당 인증서를 BASE64 또는 HEX 문자열로 획득합니다.

| 속성 | 타입 | 설명 |
| ----- | ----- | ----- |
| **Msg** | **String(필수)** | **“CERDATA”** |
| **Format** | **String(필수)** | **“BASE64” OR “HEX”** |
| **Cert** | **String(필수)** | **"인증서 정보 JSON 문자열"** |

**\[참고1\] 요청 소스 및 샘플**

| // 함수 구현부 this.getCertData \= function(certData, format, callback){ 		var \_this \= this; 		var input \={}; 		input\['Msg'\] \= "CERTDATA"; 		input\['Format'\] \= format; 		input\['Cert'\] \= JSON.stringify(certData); 		 		\_this.CertDataCallback \= callback; 		\_this.sendMsg(input); 	}; // 웹소켓으로 전송할 input 결과 {"Msg":"CERTDATA","Format":"HEX","Cert":"{"User":"홍길동()...."}} //HEX DATA {"Msg":"CERTDATA","Format":"BASE64”,"Cert":"{"User":"홍길동()...."}} //BASE64 DATA |
| :---- |

| 속성 | 타입 | 설명 |
| ----- | ----- | ----- |
| **ErrorCode** | **String(필수)** | **결과 코드(“00000000”:정상, 그외 오류)** |
| **ErrorMessage** | **String** | **오류메세지** |
| **Result** | **Object** | **인증서 변환 결과** |
| **PublicKey** | **String** | **인증서 문자열**  |
| **PrivateKey** | **String** | **개인키 문자열** |

**\[참고2\] 응답 소스 및 샘플**

| //실제 함수 사용 CooconiSASNX.getCertData(certInfo, 'HEX', function(result) { 				if (null \!= result) { 					if (null \!= result\['PublicKey'\]) { 						certInfo\['PublicKey'\] \= result\['PublicKey'\]; 					} 					if (null \!= result\['PrivateKey'\]) { 						certInfo\['PrivateKey'\] \= result\['PrivateKey'\]; 					}					 	         	}     웹소켓 Output 형태 HEX 결과	 {"Msg":"CERTDATA","Format":"HEX","ErrorCode":"00000000","ErrorMessage":"","Result":{"PublicKey":"308205A...","PrivateKey":"308205103..."}}   BASE64 결과 {"Msg":"CERTDATA","Format":"BASE64","ErrorCode":"00000000","ErrorMessage":"","Result":{"PublicKey":"MIIFrjC...","PrivateKey":"MIIFrjCCB.."}}   |
| :---- |

9. **인증서** **식별자** **검증**

인증서 식별자 검증 API는 인증서를 통해 인증서 사용자를 검증합니다. 

| 속성 | 타입 | 설명 |
| ----- | ----- | ----- |
| **Module** | **String(필수)** | **"iSAS30/SASUtils"** |
| **Class** | **String(필수)** | **"iSASUtils"** |
| **Job** | **String(필수)** | **"verifyIDNum"** |
| **Input** | **Object** |  |
| **주민사업자번호** | **String(필수)** |  |
| **인증서** | **Object** |  |
| **이름** | **String** |  |
| **만료일자** | **String** |  |
| **비밀번호** | **String** |  |

**\[참고1\] 요청 샘플**

| { "Module": "iSAS30/SASUtils", "Class": "iSASUtils", "Job": "verifyIDNum", "Input": { 	"주민사업자번호": "ENC=aaaaaa", 	"인증서": { 		"이름": "cn=홍길동()0003040201704221002671,ou=IBK,ou=personal4IB,o=yessign,c=kr", 		"만료일자": "20201120", 		"비밀번호": "password\!\!" 		"Drive”: "C" 	} } } |
| :---- |

| 속성 | 타입 | 설명 |
| ----- | ----- | ----- |
| **ErrorCode** | **String(필수)** | **결과 코드(“00000000”:정상, 그외 오류)** |
| **ErrorMessage** | **String** | **오류메세지** |
| **Result** | **Object** | **조회결과** |
| **UserName** | **String** | **식별자 명** |
| **VerifyResult** | **boolean** | **식별자 확인 결과** |

**\[참고2\] 응답 샘플**

| {     "Module": "iSAS30/SASUtils",     "Class": "iSASUtils",     "Job": "verifyIDNum", "로그인방식": "CERT", "Input": { "주민사업자번호": "\*\*\*\*\*\*\*\*\*\*\*\*",  "인증서": { "이름": "cn=홍길동()000304820191120142636123,ou=IBK,ou=personal4IB,o=yessign,c=kr", "만료일자": "20201120", "비밀번호": "\*\*\*\*\*\*\*\*\*\*\*", " Drive": "C" } }, "Output": { "ErrorCode": "00000000", "ErrorMessage": "", "Result": {         "UserName": "홍길동",         "VerifyResult": true       }  } } |
| :---- |

10. **모듈 초기화**

WebSocket 엔진을 실행하며, 설치확인 실행결과를 Callback으로 결과를 제공합니다.

**\[참고1\] 샘플소스**

|  $(document).ready(function($){ 	CooconiSASNX.init( function (o){ 		if(\!o){ 			alert('설치 후 이용하시기 바랍니다.'); 			return; 		} 	}); });  |
| :---- |

11. **Open 및 Thread 할당**

초기화된 엔진에 Thread 할당 및 라이선스 검증을 실행합니다. 

**\[참고1\] 샘플소스**

|  var ThreadCount  \= 1 ;  //한번에 실행할 Thread 길이설정 CooconiSASNX.open( ThreadCount , function (res){			 	if(res.ErrorCode \== "00000000" ){//Open 성공 /\*\* \* 쓰레드 별 입력 설정 후 스크래핑실행 \*\*/ 	} });  |
| :---- |

12. **입력 데이터 설정 및 실행**

초기화된 엔진에 Thread 할당 및 라이선스 검증을 실행합니다. 

**\[참고1\] 샘플소스**

|  var ThreadCount  \= 1 ;  //한번에 실행할 Thread 길이설정 CooconiSASNX.open( ThreadCount , function (res){			 	if(res.ErrorCode \== "00000000" ){//Open 성공 /\*\* \* 쓰레드 별 입력 설정 후 스크래핑실행 \*\*/ for(var i \=0 ; i\< ThreadCount; i++){ var inputList \= \[ 	{"Module":””,"Class":””,"Job":"로그인","Input":{"로그인방식":"CERT","사용자아이디":"","사용자비밀번호":"","인증서":{"이름":rdn,"만료일자":”20180909”,"비밀번호":cpw ,"Drive":”C”}}} ,{"Module":ModuleList\[i\],"Class":BankGubun,"Job":jobName,"Input":{}} 	,{"Module":ModuleList\[i\],"Class":BankGubun,"Job":"로그아웃","Input":{}}     			\];      /\* Thread 별 Job List 설정 \*/ CooconiSASNX.execute(inputList, i , function (res1, seq){ }); } 	} }); |
| :---- |

13. **입력 암호화**

입력에 소스 누출되는 파라미터 값을 암호화하여 스크래핑 입력값으로 설정합니다.   
샘플소스의  “function encrypt(data)”를 참고하시기 바랍니다.  
**\[참고1\] 샘플소스**

|  var certParam \= {}; var certname \= "cn=홍길동(),ou=KDB,ou=personal,o=CrossCert,c=KR" var encdata1 \= encrypt( certname ); certParam\["이름"\] \= encdata1; certParam\["만료일자"\] \= "20180510"; //YYYYMMDD var encdata2 \= encrypt( “1234qwer” ); certParam\["비밀번호"\] \= encdata2; if (cinfo\[‘Drive’\] \!= null) // Mac의 경우 Drive 없음 {     cert\[‘Drive’\] \= null2void(cinfo\[‘Drive’\]); } /\* 암호화 처리 \*/ function encrypt(data){	 	var input \= {} ; 	input\['Data'\] \= data; 	input\['Uid'\] \= CooconiSASNX.OpenUid; 	input\['Action'\] \= CooconiSASNX.OpenAction; 	var param \= "data="+ encodeURIComponent(  JSON.stringify(input) ); 	var rtn \= {}; 	$.ajax({ 		url : "./encode.jsp?", 		type: "POST", 		data : param, 		async: false, 		success: function(data, textStatus, jqXHR) 		{ 			rtn \= data\['Result'\]; 		}, 		error: function (jqXHR, textStatus, errorThrown) 		{ 			alert("error"); 			rtn=null; 		} 	}); 	return rtn; } |
| :---- |
|  |

14. **결과 복호화**

스크래핑 완료된 결과를 복호화합니다.   
**\[참고1\] 샘플소스(JavaScript)**

|  … CooconiSASNX.execute(inputList, i , function (res1, seq){     /\*\*     \* 복호화 요청     \*/     $.each(res1 ,  function (o){         var r \= res1\[o\];         if( r\['Result'\] \!= null && r\['Result'\] \!= "" && typeof r\['Result'\] \=="string"){                 /\*\*                 \* 스크래핑 결과 데이터 복호화                 \*\*/                 r\['Result'\] \= JSON.parse( decrypt(r\['Result'\]) );         }     });             /\*\*      \* 복호화 결과처리     \*\*/ }); function decrypt(data){   var input \= {} ;   input\['Data'\] \= data;   input\['Uid'\] \= CooconiSASNX.OpenUid;   input\['Action'\] \= CooconiSASNX.OpenAction;   var param \= "data="+ encodeURIComponent(  JSON.stringify(input) );      var rtn \= null;   $.ajax({       url : "./decode.jsp?",       type: "POST",       data : param,       async: false,       success: function(data, textStatus, jqXHR)       {           rtn \= data\['Result'\];       },       error: function (jqXHR, textStatus, errorThrown)       {           alert("error");       }   });   return rtn; } |
| :---- |

**\[참고2\] 샘플소스(JSP)**

| \<%@page import="java.util.Iterator"%\> \<%@page import="com.coocon.securty.util.ISASSeedCBC"%\> \<%@page import="org.json.simple.parser.JSONParser"%\> \<%@page import="org.json.simple.JSONArray"%\> \<%@page import="org.json.simple.JSONObject"%\> \<%@ page language="java" contentType="application/json; charset=UTF-8" pageEncoding="UTF-8"%\> \<%   String in\_data \= (String) request.getParameter("data");  if( in\_data \!= null){    /\* JSON Parser \*/ JSONParser jParser \= new JSONParser();    /\* Input JSONArray \*/   JSONObject inJObj \= (JSONObject)jParser.parse(in\_data);   String data \= (String)inJObj.get("Data");   String Uid \= (String)inJObj.get("Uid");   String Action \= (String)inJObj.get("Action");   String decResults;    if(Uid \!= null && Action \!= null && Uid.length() \>= 30 && Action.length() \>= 30){       decResults \= ISASSeedCBC.decrypt(data , Uid, Action );   }else{       decResults \= ISASSeedCBC.decrypt(data);   }   JSONObject output \= new JSONObject();   output.put("Result", decResults);   out.println(output.toJSONString()); }else{   out.println("{}"); } %\> |
| :---- |

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>