-- Search the full public registry by descriptor instead of loading a fixed
-- popularity-ranked slice into every model request.
create index if not exists tool_registry_search_idx on public.tool_registry
using gin (to_tsvector('simple',
  coalesce(slug, '') || ' ' || coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' || coalesce(summary, '')
));

create or replace function public.search_tool_registry(search_query text, result_limit integer default 12)
returns setof public.tool_registry
language sql stable security invoker
set search_path = public
as $$
  select registry.*
  from public.tool_registry as registry
  where registry.status = 'published'
    and (
      nullif(btrim(search_query), '') is null
      or to_tsvector('simple',
        coalesce(registry.slug, '') || ' ' || coalesce(registry.title, '') || ' ' ||
        coalesce(registry.description, '') || ' ' || coalesce(registry.summary, '')
      ) @@ websearch_to_tsquery('simple', left(search_query, 200))
    )
  order by
    case when nullif(btrim(search_query), '') is null then 0 else
      ts_rank(to_tsvector('simple',
        coalesce(registry.slug, '') || ' ' || coalesce(registry.title, '') || ' ' ||
        coalesce(registry.description, '') || ' ' || coalesce(registry.summary, '')
      ), websearch_to_tsquery('simple', left(search_query, 200))) end desc,
    registry.use_count desc, registry.created_at desc
  limit least(greatest(coalesce(result_limit, 12), 1), 30);
$$;

revoke all on function public.search_tool_registry(text, integer) from public;
grant execute on function public.search_tool_registry(text, integer) to anon, authenticated, service_role;
