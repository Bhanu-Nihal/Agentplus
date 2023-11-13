import { Message } from '@/types/openai';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { useThread } from './useThread';
import { useMap } from '@/context/Map';
import mapboxgl from 'mapbox-gl';


const fetcher = (url: string) => fetch(url).then((res) => res.json());

const useAssistant = () => {
  const [isRunning, setIsRunning] = useState(false);
  const { setCenter, addMarkers } = useMap();
  const { threadID, resetThread } = useThread();
  const { data: messages, mutate } = useSWR<Message[]>(
    threadID ? `/api/openai/get-responses?threadID=${threadID}` : null,
    fetcher,
    {
      refreshInterval: 1000,
    }
  );

  const sendMessageAndRun = useCallback(
    async (content: string, files: any[] = []) => {
      if (isRunning || !threadID) return;

      setIsRunning(true);

      try {
        const messageRes = await fetch(`/api/openai/add-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            threadID,
            content,
            files,
          }),
        });

        const message = await messageRes.json();

        // Optimistically update the local messages state before revalidation
        mutate(
          (currentMessages) => [
            ...(currentMessages ?? []),
            { id: message.id, role: 'user', content: [content] },
          ],
          false
        );

        const run = await fetch(`/api/openai/run-assistant`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            threadID,
          }),
          
        });


        if (!run.ok) {
          alert('Error running assistant'); // TODO improve error feedback
          return;
        }

      

        let runRes = await run.json();
        console.log(runRes);

        // could be 'queued', 'in_progress', 'success', 'error', 'requires_action'
        // if queued or in_progress, wait and revalidate
        while (runRes.status === 'queued' || runRes.status === 'in_progress') {
          // poll for run status
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const run = await fetch(`/api/openai/get-run?threadID=${threadID}&runID=${runRes.id}`);
          runRes = await run.json();
        }

        if (runRes.status === 'requires_action') {
          // get the arguments from the tool calls
          const toolCalls = runRes.required_action.submit_tool_outputs.tool_calls;
          console.log(toolCalls);
          
          // update the map center
          const updateMapToolCall = toolCalls.find((tc: any) => tc.function.name === 'update_map');
          
          if (updateMapToolCall) {
            console.log(updateMapToolCall);
            console.log(updateMapToolCall.function.arguments);
            const { longitude, latitude, zoom, label} = JSON.parse(updateMapToolCall.function.arguments);
            setCenter({ longitude, latitude, zoom });
          }

          // const markerToolCalls = toolCalls.filter((tc: any) => tc.function.name === 'add_marker');
          // console.log(markerToolCalls);
          // const markers = markerToolCalls.map((tc: any) => {
          //   const { longitude, latitude, label } = JSON.parse(tc.function.arguments);
          //   console.log(longitude, latitude, label);
          //   return { location: { lat: latitude, lng: longitude }, label };
          // });

          const markerToolCalls = toolCalls.filter((tc: any) => tc.function.name === 'add_marker');

          if (markerToolCalls.length > 0) {
            console.log(markerToolCalls);
            const markers = markerToolCalls.map((tc: any) => {
              const { longitude, latitude, label } = JSON.parse(tc.function.arguments);
              console.log(longitude, latitude, label);
              return { location: { lat: latitude, lng: longitude }, label };
            });
            // Proceed with using `markers` here
            addMarkers(markers);
          } else {
            // `markerToolCalls` is empty, skip the mapping
            console.log('No tool calls with add_marker function found');
          }


          

          await fetch('/api/openai/submit-tool-output', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              threadID,
              runID: runRes.id,
              toolOutputs: toolCalls.map((tc: any) => ({
                output: 'true',
                tool_call_id: tc.id,
              })),
            }),
          });
        }

        // Revalidate messages to fetch the latest after running the assistant
        mutate();
      } catch (error) {
        console.error('Error sending message and running assistant:', error);
      } finally {
        setIsRunning(false);
      }
    },
    [threadID, isRunning, mutate]
  );

  return { messages, sendMessageAndRun, isRunning, resetThread };
};

export default useAssistant;
