Deno.serve(() => {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "hello edge function",
      time: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
