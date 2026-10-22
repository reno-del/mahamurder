-- Supabase SQL Editor에서 한 번 실행하세요.
-- Upstage `embedding-passage` / `embedding-query`는 4096차원입니다.
-- pgvector의 HNSW/IVFFlat 인덱스는 2000차원까지만 되므로 인덱스 없이 전체를 정확히 비교합니다.
-- (문서가 수천 개 이하라 충분히 빠릅니다.)

create extension if not exists vector with schema extensions;

create table if not exists public.mm_documents (
  id uuid primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(4096) not null
);

-- 정책을 만들지 않으므로 anon 키로는 읽고 쓸 수 없고, service_role 키(서버 전용)만 접근합니다.
alter table public.mm_documents enable row level security;

-- 코사인 유사도 = 1 - 코사인 거리(<=>). 유사도가 높은 순으로 돌려주고,
-- 몇 개를 가져올지(상위 5개)는 호출하는 쪽에서 limit으로 정합니다.
create or replace function public.match_mm_documents(
  query_embedding extensions.vector(4096),
  filter jsonb default '{}'::jsonb
)
returns table (id uuid, content text, metadata jsonb, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select d.id, d.content, d.metadata, 1 - (d.embedding <=> query_embedding) as similarity
  from public.mm_documents d
  where d.metadata @> filter
  order by d.embedding <=> query_embedding
$$;

-- "새 테이블을 Data API에 자동 공개" 설정이 꺼진 프로젝트에서도 서버 키(service_role / sb_secret_)가 쓸 수 있게 권한을 준다.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.mm_documents to service_role;
grant execute on function public.match_mm_documents(extensions.vector, jsonb) to service_role;

-- Data API가 새 테이블과 함수를 바로 알아보도록 목록을 다시 읽게 한다.
notify pgrst, 'reload schema';
