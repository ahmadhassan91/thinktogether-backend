import {
  trainingKnowledgeCheckItems,
  trainingLearningPaths,
  trainingScenarios,
  trainingSourceLibrary,
} from '../src/data/trainingData';
import type { KnowledgeCheckItem, LearningPath, Module, Scenario, SourceArtifact, SourceRef } from '../src/types';

export type SourceIntelligenceDataset = {
  artifacts?: SourceArtifact[];
  learningPaths?: LearningPath[];
  scenarios?: Scenario[];
  knowledgeCheckItems?: KnowledgeCheckItem[];
};

export type SourceUsageSummary = {
  totals: {
    artifacts: number;
    referencedArtifacts: number;
    sourceRefs: number;
    paths: number;
    modules: number;
  };
  artifacts: ArtifactUsageSummary[];
  paths: PathSourceUsageSummary[];
  modules: ModuleSourceUsageSummary[];
  sourceRefs: SourceRefUsageSummary[];
};

export type ArtifactUsageSummary = {
  artifact: SourceArtifact;
  totalReferences: number;
  uniqueLocatorCount: number;
  pathReferenceCount: number;
  moduleReferenceCount: number;
  scenarioReferenceCount: number;
  knowledgeCheckReferenceCount: number;
  referencedByPathIds: string[];
  referencedByModuleIds: string[];
  locators: string[];
};

export type PathSourceUsageSummary = {
  pathId: string;
  pathTitle: string;
  sourceRefCount: number;
  moduleCount: number;
  artifacts: string[];
  sourceRefs: SourceRef[];
};

export type ModuleSourceUsageSummary = {
  moduleId: string;
  moduleTitle: string;
  pathId: string;
  pathTitle: string;
  sourceRefCount: number;
  scenarioSourceRefCount: number;
  knowledgeCheckSourceRefCount: number;
  artifacts: string[];
  sourceRefs: SourceRef[];
};

export type SourceRefUsageSummary = {
  artifact: string;
  locator: string;
  count: number;
  contexts: SourceRefContext[];
};

export type SourceRefContext = {
  type: 'path' | 'module' | 'scenario' | 'knowledge-check';
  id: string;
  title: string;
  pathId?: string;
  pathTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
};

export type SourceSearchResult = {
  type: 'artifact' | 'path' | 'module' | 'scenario' | 'knowledge-check';
  id: string;
  title: string;
  artifact: SourceArtifact;
  locator: string;
  sourceRef: SourceRef;
  path?: {
    id: string;
    title: string;
  };
  module?: {
    id: string;
    title: string;
  };
  excerpt: string;
  relevanceScore: number;
};

export type SourceQaFlags = {
  artifactsNotReferencedByModules: SourceArtifact[];
  modulesWithNoSourceRefs: Array<{
    moduleId: string;
    moduleTitle: string;
    pathId: string;
    pathTitle: string;
  }>;
  pathsWithNoModules: Array<{
    pathId: string;
    pathTitle: string;
  }>;
  sourceRefsWithoutLibraryArtifact: Array<{
    sourceRef: SourceRef;
    contexts: SourceRefContext[];
  }>;
};

type SourceIndexEntry = {
  type: SourceSearchResult['type'];
  id: string;
  title: string;
  searchableText: string;
  excerpt: string;
  sourceRef: SourceRef;
  artifact: SourceArtifact;
  path?: {
    id: string;
    title: string;
  };
  module?: {
    id: string;
    title: string;
  };
};

const stopWords = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'before',
  'for',
  'from',
  'how',
  'into',
  'the',
  'their',
  'this',
  'that',
  'think',
  'together',
  'what',
  'when',
  'where',
  'which',
  'with',
]);

export function summarizeSourceUsage(dataset: SourceIntelligenceDataset = {}): SourceUsageSummary {
  const data = resolveDataset(dataset);
  const artifactByName = buildArtifactMap(data.artifacts);
  const usageByArtifact = new Map<string, ArtifactUsageSummary>();
  const sourceRefUsage = new Map<string, SourceRefUsageSummary>();

  for (const artifact of data.artifacts) {
    usageByArtifact.set(artifact.artifact, {
      artifact,
      totalReferences: 0,
      uniqueLocatorCount: 0,
      pathReferenceCount: 0,
      moduleReferenceCount: 0,
      scenarioReferenceCount: 0,
      knowledgeCheckReferenceCount: 0,
      referencedByPathIds: [],
      referencedByModuleIds: [],
      locators: [],
    });
  }

  const register = (sourceRef: SourceRef, context: SourceRefContext) => {
    const artifact = artifactByName.get(sourceRef.artifact);
    if (!artifact) return;

    const artifactUsage = usageByArtifact.get(artifact.artifact);
    if (!artifactUsage) return;

    artifactUsage.totalReferences += 1;
    if (context.type === 'path') artifactUsage.pathReferenceCount += 1;
    if (context.type === 'module') artifactUsage.moduleReferenceCount += 1;
    if (context.type === 'scenario') artifactUsage.scenarioReferenceCount += 1;
    if (context.type === 'knowledge-check') artifactUsage.knowledgeCheckReferenceCount += 1;
    artifactUsage.locators = sortedUnique([...artifactUsage.locators, sourceRef.locator]);
    if (context.pathId) artifactUsage.referencedByPathIds = sortedUnique([...artifactUsage.referencedByPathIds, context.pathId]);
    if (context.moduleId) artifactUsage.referencedByModuleIds = sortedUnique([...artifactUsage.referencedByModuleIds, context.moduleId]);
    artifactUsage.uniqueLocatorCount = artifactUsage.locators.length;

    const sourceRefKey = formatSourceRefKey(sourceRef);
    const existing = sourceRefUsage.get(sourceRefKey);
    if (existing) {
      existing.count += 1;
      existing.contexts.push(context);
    } else {
      sourceRefUsage.set(sourceRefKey, {
        artifact: sourceRef.artifact,
        locator: sourceRef.locator,
        count: 1,
        contexts: [context],
      });
    }
  };

  for (const path of data.learningPaths) {
    for (const sourceRef of path.sourceRefs) {
      register(sourceRef, {
        type: 'path',
        id: path.id,
        title: path.title,
        pathId: path.id,
        pathTitle: path.title,
      });
    }

    for (const moduleItem of path.modules) {
      for (const sourceRef of moduleItem.content.sourceRefs) {
        register(sourceRef, moduleContext('module', moduleItem.id, moduleItem.title, path, moduleItem));
      }
    }
  }

  for (const scenario of data.scenarios) {
    const moduleLocation = findModuleLocation(scenario.moduleId, data.learningPaths);
    for (const sourceRef of scenario.sourceRefs) {
      register(sourceRef, {
        type: 'scenario',
        id: scenario.id,
        title: scenario.title,
        pathId: moduleLocation?.path.id,
        pathTitle: moduleLocation?.path.title,
        moduleId: moduleLocation?.module.id ?? scenario.moduleId,
        moduleTitle: moduleLocation?.module.title,
      });
    }
  }

  for (const item of data.knowledgeCheckItems) {
    const moduleLocation = findModuleLocation(item.moduleId, data.learningPaths);
    for (const sourceRef of item.sourceRefs) {
      register(sourceRef, {
        type: 'knowledge-check',
        id: item.id,
        title: item.prompt,
        pathId: moduleLocation?.path.id,
        pathTitle: moduleLocation?.path.title,
        moduleId: moduleLocation?.module.id ?? item.moduleId,
        moduleTitle: moduleLocation?.module.title,
      });
    }
  }

  const pathSummaries = data.learningPaths.map((path) => ({
    pathId: path.id,
    pathTitle: path.title,
    sourceRefCount: path.sourceRefs.length,
    moduleCount: path.modules.length,
    artifacts: sortedUnique(path.sourceRefs.map((sourceRef) => sourceRef.artifact)),
    sourceRefs: [...path.sourceRefs],
  }));

  const moduleSummaries = data.learningPaths.flatMap((path) =>
    path.modules.map((moduleItem) => {
      const scenarios = data.scenarios.filter((scenario) => scenario.moduleId === moduleItem.id);
      const knowledgeCheckItems = data.knowledgeCheckItems.filter((item) => item.moduleId === moduleItem.id);
      const sourceRefs = [
        ...moduleItem.content.sourceRefs,
        ...scenarios.flatMap((scenario) => scenario.sourceRefs),
        ...knowledgeCheckItems.flatMap((item) => item.sourceRefs),
      ];

      return {
        moduleId: moduleItem.id,
        moduleTitle: moduleItem.title,
        pathId: path.id,
        pathTitle: path.title,
        sourceRefCount: moduleItem.content.sourceRefs.length,
        scenarioSourceRefCount: scenarios.reduce((count, scenario) => count + scenario.sourceRefs.length, 0),
        knowledgeCheckSourceRefCount: knowledgeCheckItems.reduce((count, item) => count + item.sourceRefs.length, 0),
        artifacts: sortedUnique(sourceRefs.map((sourceRef) => sourceRef.artifact)),
        sourceRefs,
      };
    }),
  );

  const artifacts = Array.from(usageByArtifact.values()).sort((left, right) => left.artifact.artifact.localeCompare(right.artifact.artifact));
  const sourceRefs = Array.from(sourceRefUsage.values()).sort((left, right) =>
    formatSourceRefKey(left).localeCompare(formatSourceRefKey(right)),
  );

  return {
    totals: {
      artifacts: data.artifacts.length,
      referencedArtifacts: artifacts.filter((artifact) => artifact.totalReferences > 0).length,
      sourceRefs: sourceRefs.reduce((count, sourceRef) => count + sourceRef.count, 0),
      paths: data.learningPaths.length,
      modules: data.learningPaths.reduce((count, path) => count + path.modules.length, 0),
    },
    artifacts,
    paths: pathSummaries,
    modules: moduleSummaries,
    sourceRefs,
  };
}

export function searchSourceIntelligence(query: string, dataset: SourceIntelligenceDataset = {}): SourceSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const terms = tokenize(normalizedQuery);
  if (terms.length === 0) return [];

  return buildSourceIndex(resolveDataset(dataset))
    .map((entry) => ({
      entry,
      relevanceScore: scoreSourceEntry(entry, normalizedQuery, terms),
    }))
    .filter((match) => match.relevanceScore > 0)
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) return right.relevanceScore - left.relevanceScore;
      return left.entry.title.localeCompare(right.entry.title);
    })
    .map(({ entry, relevanceScore }) => ({
      type: entry.type,
      id: entry.id,
      title: entry.title,
      artifact: entry.artifact,
      locator: entry.sourceRef.locator,
      sourceRef: entry.sourceRef,
      path: entry.path,
      module: entry.module,
      excerpt: entry.excerpt,
      relevanceScore,
    }));
}

export function computeSourceQaFlags(dataset: SourceIntelligenceDataset = {}): SourceQaFlags {
  const data = resolveDataset(dataset);
  const moduleArtifactNames = new Set(
    data.learningPaths.flatMap((path) => path.modules.flatMap((moduleItem) => moduleItem.content.sourceRefs.map((ref) => ref.artifact))),
  );
  const artifactsNotReferencedByModules = data.artifacts
    .filter((artifact) => !moduleArtifactNames.has(artifact.artifact))
    .sort((left, right) => left.artifact.localeCompare(right.artifact));
  const modulesWithNoSourceRefs = data.learningPaths.flatMap((path) =>
    path.modules
      .filter((moduleItem) => moduleItem.content.sourceRefs.length === 0)
      .map((moduleItem) => ({
        moduleId: moduleItem.id,
        moduleTitle: moduleItem.title,
        pathId: path.id,
        pathTitle: path.title,
      })),
  );
  const pathsWithNoModules = data.learningPaths
    .filter((path) => path.modules.length === 0)
    .map((path) => ({
      pathId: path.id,
      pathTitle: path.title,
    }));
  const artifactNames = new Set(data.artifacts.map((artifact) => artifact.artifact));
  const refsWithoutArtifact = new Map<string, { sourceRef: SourceRef; contexts: SourceRefContext[] }>();

  for (const entry of collectSourceRefContexts(data)) {
    if (artifactNames.has(entry.sourceRef.artifact)) continue;

    const key = formatSourceRefKey(entry.sourceRef);
    const existing = refsWithoutArtifact.get(key);
    if (existing) {
      existing.contexts.push(entry.context);
    } else {
      refsWithoutArtifact.set(key, {
        sourceRef: entry.sourceRef,
        contexts: [entry.context],
      });
    }
  }

  return {
    artifactsNotReferencedByModules,
    modulesWithNoSourceRefs,
    pathsWithNoModules,
    sourceRefsWithoutLibraryArtifact: Array.from(refsWithoutArtifact.values()).sort((left, right) =>
      formatSourceRefKey(left.sourceRef).localeCompare(formatSourceRefKey(right.sourceRef)),
    ),
  };
}

function buildSourceIndex(data: Required<SourceIntelligenceDataset>): SourceIndexEntry[] {
  const artifactByName = buildArtifactMap(data.artifacts);
  const entries: SourceIndexEntry[] = [];

  for (const artifact of data.artifacts) {
    entries.push({
      type: 'artifact',
      id: artifact.id,
      title: artifact.title,
      searchableText: [
        artifact.id,
        artifact.artifact,
        artifact.title,
        artifact.documentType,
        artifact.department,
        artifact.effectiveDate,
        artifact.reviewDate,
        artifact.contentVersion,
      ].join(' '),
      excerpt: `${artifact.title} (${artifact.documentType})`,
      sourceRef: {
        artifact: artifact.artifact,
        locator: 'Artifact metadata',
      },
      artifact,
    });
  }

  for (const path of data.learningPaths) {
    for (const sourceRef of path.sourceRefs) {
      const artifact = artifactByName.get(sourceRef.artifact);
      if (!artifact) continue;

      entries.push({
        type: 'path',
        id: path.id,
        title: path.title,
        searchableText: [path.title, path.description, path.audience, formatSourceRef(sourceRef)].join(' '),
        excerpt: path.description,
        sourceRef,
        artifact,
        path: {
          id: path.id,
          title: path.title,
        },
      });
    }

    for (const moduleItem of path.modules) {
      for (const sourceRef of moduleItem.content.sourceRefs) {
        const artifact = artifactByName.get(sourceRef.artifact);
        if (!artifact) continue;

        entries.push({
          type: 'module',
          id: moduleItem.id,
          title: moduleItem.title,
          searchableText: [
            moduleItem.title,
            moduleItem.content.summary,
            moduleItem.content.learningObjectives.join(' '),
            moduleItem.content.keyPoints.join(' '),
            formatSourceRef(sourceRef),
          ].join(' '),
          excerpt: moduleItem.content.summary,
          sourceRef,
          artifact,
          path: {
            id: path.id,
            title: path.title,
          },
          module: {
            id: moduleItem.id,
            title: moduleItem.title,
          },
        });
      }
    }
  }

  for (const scenario of data.scenarios) {
    const moduleLocation = findModuleLocation(scenario.moduleId, data.learningPaths);
    for (const sourceRef of scenario.sourceRefs) {
      const artifact = artifactByName.get(sourceRef.artifact);
      if (!artifact) continue;

      entries.push({
        type: 'scenario',
        id: scenario.id,
        title: scenario.title,
        searchableText: [
          scenario.title,
          scenario.prompt,
          scenario.skillFocus,
          scenario.expectedResponseElements.join(' '),
          formatSourceRef(sourceRef),
        ].join(' '),
        excerpt: `${scenario.prompt} Focus: ${scenario.skillFocus}.`,
        sourceRef,
        artifact,
        path: moduleLocation
          ? {
              id: moduleLocation.path.id,
              title: moduleLocation.path.title,
            }
          : undefined,
        module: moduleLocation
          ? {
              id: moduleLocation.module.id,
              title: moduleLocation.module.title,
            }
          : {
              id: scenario.moduleId,
              title: scenario.moduleId,
            },
      });
    }
  }

  for (const item of data.knowledgeCheckItems) {
    const moduleLocation = findModuleLocation(item.moduleId, data.learningPaths);
    for (const sourceRef of item.sourceRefs) {
      const artifact = artifactByName.get(sourceRef.artifact);
      if (!artifact) continue;

      entries.push({
        type: 'knowledge-check',
        id: item.id,
        title: item.prompt,
        searchableText: [item.prompt, item.choices.join(' '), item.correctAnswer, item.rationale, formatSourceRef(sourceRef)].join(' '),
        excerpt: `${item.correctAnswer}. ${item.rationale}`,
        sourceRef,
        artifact,
        path: moduleLocation
          ? {
              id: moduleLocation.path.id,
              title: moduleLocation.path.title,
            }
          : undefined,
        module: moduleLocation
          ? {
              id: moduleLocation.module.id,
              title: moduleLocation.module.title,
            }
          : {
              id: item.moduleId,
              title: item.moduleId,
            },
      });
    }
  }

  return entries;
}

function collectSourceRefContexts(data: Required<SourceIntelligenceDataset>) {
  const entries: Array<{ sourceRef: SourceRef; context: SourceRefContext }> = [];

  for (const path of data.learningPaths) {
    entries.push(
      ...path.sourceRefs.map((sourceRef) => ({
        sourceRef,
        context: {
          type: 'path' as const,
          id: path.id,
          title: path.title,
          pathId: path.id,
          pathTitle: path.title,
        },
      })),
    );

    for (const moduleItem of path.modules) {
      entries.push(
        ...moduleItem.content.sourceRefs.map((sourceRef) => ({
          sourceRef,
          context: moduleContext('module', moduleItem.id, moduleItem.title, path, moduleItem),
        })),
      );
    }
  }

  for (const scenario of data.scenarios) {
    const moduleLocation = findModuleLocation(scenario.moduleId, data.learningPaths);
    entries.push(
      ...scenario.sourceRefs.map((sourceRef) => ({
        sourceRef,
        context: {
          type: 'scenario' as const,
          id: scenario.id,
          title: scenario.title,
          pathId: moduleLocation?.path.id,
          pathTitle: moduleLocation?.path.title,
          moduleId: moduleLocation?.module.id ?? scenario.moduleId,
          moduleTitle: moduleLocation?.module.title,
        },
      })),
    );
  }

  for (const item of data.knowledgeCheckItems) {
    const moduleLocation = findModuleLocation(item.moduleId, data.learningPaths);
    entries.push(
      ...item.sourceRefs.map((sourceRef) => ({
        sourceRef,
        context: {
          type: 'knowledge-check' as const,
          id: item.id,
          title: item.prompt,
          pathId: moduleLocation?.path.id,
          pathTitle: moduleLocation?.path.title,
          moduleId: moduleLocation?.module.id ?? item.moduleId,
          moduleTitle: moduleLocation?.module.title,
        },
      })),
    );
  }

  return entries;
}

function moduleContext(
  type: SourceRefContext['type'],
  id: string,
  title: string,
  path: LearningPath,
  moduleItem: Module,
): SourceRefContext {
  return {
    type,
    id,
    title,
    pathId: path.id,
    pathTitle: path.title,
    moduleId: moduleItem.id,
    moduleTitle: moduleItem.title,
  };
}

function scoreSourceEntry(entry: SourceIndexEntry, normalizedQuery: string, terms: string[]) {
  const normalizedTitle = normalize(entry.title);
  const normalizedArtifact = normalize(`${entry.artifact.artifact} ${entry.artifact.title}`);
  const normalizedLocator = normalize(entry.sourceRef.locator);
  const normalizedText = normalize(entry.searchableText);
  let score = 0;

  if (normalizedText.includes(normalizedQuery)) score += 10;
  if (normalizedTitle.includes(normalizedQuery)) score += 8;
  if (normalizedArtifact.includes(normalizedQuery)) score += 6;
  if (normalizedLocator.includes(normalizedQuery)) score += 5;

  for (const term of terms) {
    if (normalizedTitle.includes(term)) score += 4;
    if (normalizedArtifact.includes(term)) score += 3;
    if (normalizedLocator.includes(term)) score += 3;
    if (normalizedText.includes(term)) score += 1;
  }

  return score;
}

function findModuleLocation(moduleId: string, learningPaths: LearningPath[]) {
  for (const path of learningPaths) {
    const moduleItem = path.modules.find((candidate) => candidate.id === moduleId);
    if (moduleItem) {
      return {
        path,
        module: moduleItem,
      };
    }
  }

  return undefined;
}

function resolveDataset(dataset: SourceIntelligenceDataset): Required<SourceIntelligenceDataset> {
  return {
    artifacts: dataset.artifacts ?? trainingSourceLibrary,
    learningPaths: dataset.learningPaths ?? trainingLearningPaths,
    scenarios: dataset.scenarios ?? trainingScenarios,
    knowledgeCheckItems: dataset.knowledgeCheckItems ?? trainingKnowledgeCheckItems,
  };
}

function buildArtifactMap(artifacts: SourceArtifact[]) {
  return new Map(artifacts.flatMap((artifact) => [[artifact.artifact, artifact], [artifact.id, artifact]]));
}

function tokenize(text: string) {
  return sortedUnique(
    text
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !stopWords.has(term)),
  );
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatSourceRef(sourceRef: SourceRef) {
  return `${sourceRef.artifact} (${sourceRef.locator})`;
}

function formatSourceRefKey(sourceRef: Pick<SourceRef, 'artifact' | 'locator'>) {
  return `${sourceRef.artifact}::${sourceRef.locator}`;
}

function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}
