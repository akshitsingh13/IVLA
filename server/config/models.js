// Single place to change models. NVIDIA OpenAI-compatible endpoints.

// Verified with scripts/probe-models.js on 2026-11-09:
//  - llama-3.2-11b-vision-instruct was removed (HTTP 410), so it is gone.
//  - nemotron-3.5-super-vl is fast (~1s) and reads images via image_url. It is a
//    REASONING model: it "thinks" before answering and those tokens count against
//    max_tokens, so keep max_tokens generous in tasks/*.js or the reply comes back empty.
//  - llama-3.2-90b-vision-instruct still works but takes ~30s even for one word,
//    so it is only a slow last-resort fallback.
export const MODELS = {
  vision: {
    primary: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    fallback: "meta/llama-3.2-90b-vision-instruct",
  },
  text: {
    primary: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    fallback: "meta/llama-3.2-90b-vision-instruct",
  },
  image: {
    primary: "black-forest-labs/flux.2-klein-4b",
  },
};

export const NVIDIA_CHAT_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";
export const NVIDIA_IMAGE_URL =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";
export const POLLINATIONS_URL = "https://image.pollinations.ai/prompt/";
