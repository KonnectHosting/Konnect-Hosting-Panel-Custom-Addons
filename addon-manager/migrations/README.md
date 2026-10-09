Manager tables are installed idempotently by `Laravel\\ManagerSchema`, without
copying executable migrations into the Panel or running unrelated migrations.
Filesystem registry and deployment journals remain the recovery authority.
Addon schema steps are checksum-bound JSON, interpreted by `MigrationExecutor`;
there is no raw SQL, PHP migration loading, rollback DDL, or implicit data purge.
