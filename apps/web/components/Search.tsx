'use client';

import { useState } from 'react';
import {
  Search as SearchIcon,
  FileText,
  Bot,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  X,
  Sparkles,
  Database,
} from 'lucide-react';
import { cn, formatRelativeTime, extractPreview } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  ErrorState,
  Kbd,
} from '@/components/ui';
import { useSearch } from '@/hooks/useSearch';

export default function Search() {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('');

  const { data: results, isLoading, error, refetch } = useSearch(query, agentFilter);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already debounced automatically via the hook
  };

  const hasResults = results && results.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* ===== Header ===== */}
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-sm text-surface-400 mt-1">
          Search across all missions, agents, and system data
        </p>
      </div>

      {/* ===== Search Bar ===== */}
      <form onSubmit={handleSearch}>
        <div className="relative group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 group-focus-within:text-aegis-400 transition-colors" />
          <input
            type="text"
            placeholder="Search the knowledge base... (try &quot;mission&quot;, &quot;agent&quot;, &quot;error&quot;)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-surface-800/60 border border-surface-700/50 rounded-2xl pl-12 pr-4 py-4 text-base text-surface-200 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-aegis-400/30 focus:border-aegis-500/50 transition-all"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700/50 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* ===== Results ===== */}
      <div className="space-y-3">
        {query && isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-28" />
            ))}
          </div>
        )}

        {error && (
          <ErrorState
            title="Search failed"
            message="Could not perform the search query."
            onRetry={() => refetch()}
          />
        )}

        {query && !isLoading && !error && !hasResults && (
          <EmptyState
            icon={<SearchIcon className="w-7 h-7" />}
            title="No results found"
            description={`No matches for "${query}". Try different keywords.`}
          />
        )}

        {query && hasResults && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-500">
                Found {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
                <span className="text-surface-300 font-mono">&ldquo;{query}&rdquo;</span>
              </p>
            </div>

            {results.map((result, i) => {
              const id = result.id as string;
              const content = result.content as string;
              const score = result.score as number;
              const source = result.source as string;
              const metadata = result.metadata as Record<string, unknown>;
              const isExpanded = expandedId === id;

              return (
                <Card
                  key={id}
                  className="group"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <CardBody className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Score indicator */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-aegis-500/10 border border-aegis-500/20 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-aegis-400" />
                        </div>
                        <span className="text-[10px] font-mono text-surface-500">
                          {score ? `${Math.round(score * 100)}%` : 'N/A'}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {source && (
                          <Badge variant="info" size="sm" className="mb-2">
                            {source}
                          </Badge>
                        )}
                        <p
                          className={cn(
                            'text-sm text-surface-300 leading-relaxed',
                            !isExpanded && 'line-clamp-3'
                          )}
                        >
                          {content ? extractPreview(content, isExpanded ? 1000 : 200) : 'No content'}
                        </p>

                        {/* Metadata */}
                        {metadata && Object.keys(metadata).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {Object.entries(metadata).map(([key, val]) => (
                              <Badge key={key} variant="default" size="sm">
                                {key}: {String(val).slice(0, 30)}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Expand */}
                        {content && content.length > 200 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : id)}
                            className="flex items-center gap-1 mt-2 text-xs text-aegis-400 hover:text-aegis-300 transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                Show less <ChevronUp className="w-3 h-3" />
                              </>
                            ) : (
                              <>
                                Show more <ChevronDown className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
