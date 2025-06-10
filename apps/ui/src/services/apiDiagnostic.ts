// API Diagnostic Tool
import { api } from "./api";

/**
 * This function tests API connectivity by making a simple request
 * to the backend and logging the results.
 */
export async function testApiConnectivity() {
  try {
    console.log("API Diagnostic: Testing connectivity...");
    console.log("API Base URL:", api.defaults.baseURL);

    // Make a simple request to check if API is accessible
    const response = await api.get("/health", { timeout: 5000 });
    console.log(
      "API Diagnostic: Connected successfully!",
      response.status,
      response.data
    );
    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string; code?: string };
    console.error("API Diagnostic: Connection failed!");
    console.error("Error details:", {
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      message: axiosError.message,
      code: axiosError.code,
    });

    return {
      success: false,
      status: axiosError.response?.status,
      error: axiosError.message || 'Unknown error',
      details: axiosError.response?.data,
    };
  }
}
