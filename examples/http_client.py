"""Python 3.9+ 标准库示例：一次抽牌，使用同一结果生成追问提示词。"""

import json
import os
import sys
from urllib.error import HTTPError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


base = urlsplit(os.environ.get('MINGYU_BASE_URL') or 'http://127.0.0.1:18788')
if base.scheme not in ('http', 'https') or not base.hostname or base.username or base.password or base.query or base.fragment:
    raise ValueError('MINGYU_BASE_URL 必须是不含账号、查询参数或片段的 HTTP(S) 地址。')
token = os.environ.get('MINGYU_ACCESS_TOKEN', '').strip()
if any(character.isspace() for character in token):
    raise ValueError('MINGYU_ACCESS_TOKEN 不能包含空白字符。')
opener = build_opener(NoRedirect())


def post(path, data):
    url = urlunsplit((base.scheme, base.netloc, base.path.rstrip('/') + path, '', ''))
    headers = {'content-type': 'application/json'}
    if token:
        headers['authorization'] = 'Bearer ' + token
    request = Request(url, data=json.dumps(data, ensure_ascii=False).encode('utf-8'), headers=headers, method='POST')
    try:
        with opener.open(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f'HTTP {error.code}：{error.read().decode("utf-8", errors="replace")}') from error


def calculate(method, input_data):
    return post('/api/calculate', {'method': method, 'input': input_data})


def reprompt(method, result, question, *, current_time=None, prompt=None):
    body = {'method': method, 'result': result, 'question': question}
    if current_time is not None:
        body['currentTime'] = current_time
    if prompt is not None:
        body['prompt'] = prompt
    return post('/api/prompt', body)


if __name__ == '__main__':
    question = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else '近期工作应注意什么？'
    followup_question = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else '针对这组牌，接下来可以如何行动？'
    result = calculate('tarot', {'question': question, 'tarot': {'spread': 'three'}})
    followup = reprompt('tarot', result, followup_question)
    print(json.dumps({'result': result, 'followup': followup}, ensure_ascii=False, indent=2))
