import logger from '../logger';

async function checkSystemHealth(): Promise<{ status: string; detail: string }> {
  const base = process.env.SIYUAN_BASE_URL;
  const token = process.env.SIYUAN_TOKEN;
  
  if (!base) {
    return { status: 'degraded', detail: 'SIYUAN_BASE_URL not set' };
  }

  try {
    const res = await fetch(`${base}/api/system/version`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {})
      },
      body: JSON.stringify({})
    });
    
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }
    
    const text = await res.text();
    
    // 处理空响应
    if (!text.trim()) {
      return { status: 'ok', detail: 'Empty response' };
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      logger.error({ error: parseError, text }, 'JSON parse failed in system health check');
      return { status: 'degraded', detail: `Invalid JSON response: ${text.substring(0, 100)}` };
    }
    
    // 检查思源API标准响应格式
    if (result.code !== undefined && result.code !== 0) {
      return { status: 'degraded', detail: `Siyuan API error: ${result.msg}` };
    }
    
    return { status: 'ok', detail: JSON.stringify(result.data || result) };
  } catch (err) {
    logger.error(String(err));
    return { status: 'degraded', detail: String(err) };
  }
}
