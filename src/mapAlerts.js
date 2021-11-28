export default async function * (body) {
  const { alerts, commonLabels, commonAnnotations, externalURL } = body;
  for (const {
    status,
    labels,
    annotations,
    startsAt,
    endsAt,
    generatorURL,
  } of alerts) {
    const mergedLabels = {
      ...commonLabels,
      ...labels,
    };
    const mergedAnnotations = {
      ...commonAnnotations,
      ...annotations,
    };
    yield {
      status,
      labels: mergedLabels,
      annotations: mergedAnnotations,
      startsAt,
      endsAt,
      generatorURL,
      externalURL,
    };
  }
};
