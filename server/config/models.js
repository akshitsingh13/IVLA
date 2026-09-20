// Single place to change models. NVIDIA OpenAI-compatible endpoints.

export const MODELS = {
  vision: {
    primary: "meta/llama-3.2-11b-vision-instruct",
    fallback: "meta/llama-3.2-90b-vision-instruct",
  },
  text: {
    primary: "meta/llama-3.2-11b-vision-instruct",
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
