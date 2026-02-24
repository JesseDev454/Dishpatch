import { api } from "./api";
import {
  AnalyticsOverviewResponse,
  AnalyticsRange,
  AnalyticsTopItemsResponse,
  AnalyticsTimeseriesResponse
} from "../types";

export const getOverview = async (range: AnalyticsRange): Promise<AnalyticsOverviewResponse> => {
  const response = await api.get<AnalyticsOverviewResponse>("/analytics/overview", {
    params: { range }
  });
  return response.data;
};

export const getTimeseries = async (range: AnalyticsRange): Promise<AnalyticsTimeseriesResponse> => {
  const response = await api.get<AnalyticsTimeseriesResponse>("/analytics/timeseries", {
    params: { range }
  });
  return response.data;
};

export const getTopItems = async (range: AnalyticsRange, limit = 5): Promise<AnalyticsTopItemsResponse> => {
  const response = await api.get<AnalyticsTopItemsResponse>("/analytics/top-items", {
    params: { range, limit }
  });
  return response.data;
};

