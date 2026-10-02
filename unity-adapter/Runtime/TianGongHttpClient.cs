// 来源：天工项目原创代码，未复制第三方代码。

using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

namespace TianGong.UnityAdapter
{
    public sealed class TianGongHttpClient : MonoBehaviour
    {
        [SerializeField] private string endpoint = "http://127.0.0.1:4173/api/v1";

        public void PreviewCraft(TianGongCraftRequest request, Action<TianGongCraftPreview> onSuccess, Action<string> onError)
        {
            StartCoroutine(PostJson("/craft/preview", request, onSuccess, onError));
        }

        public void CommitCraft(TianGongCraftRequest request, Action<TianGongCraftResult> onSuccess, Action<string> onError)
        {
            StartCoroutine(PostJson("/craft/commit", request, onSuccess, onError));
        }

        private IEnumerator PostJson<TRequest, TResponse>(string path, TRequest payload, Action<TResponse> onSuccess, Action<string> onError)
        {
            string json = JsonUtility.ToJson(payload);
            using UnityWebRequest request = new UnityWebRequest(endpoint.TrimEnd('/') + path, "POST");
            byte[] body = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(body);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                onError?.Invoke(request.error);
                yield break;
            }

            try
            {
                TResponse response = JsonUtility.FromJson<TResponse>(request.downloadHandler.text);
                onSuccess?.Invoke(response);
            }
            catch (Exception exception)
            {
                onError?.Invoke($"天工响应解析失败：{exception.Message}");
            }
        }
    }
}
