import { useCallback, useState } from 'react';
import { analyzeArea } from '../services/analysisService';

export function useMapAnalysis() {
  const [analysisRequest, setAnalysisRequest] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const submitAnalysis = useCallback(async (areaData) => {
    setAnalysisRequest(areaData);
    setAnalyzing(true);
    try {
      return await analyzeArea(areaData);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  return { analysisRequest, analyzing, submitAnalysis };
}
