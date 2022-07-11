# nocfl-js

An opinionated S3 storage library inspired by ocfl but without versioning

# Background

In working with the [Oxford Common File Layout - OCFL](https://ocfl.io) we came to realise that some
quite serious compromises were required. This is not to say that OCFL is not a good specification;
just that we needed something different.

The name of this library came from [Peter Sefton](https://github.com/ptsefton).

# Tests

This library has extensive tests. To run them: `npm run test:watch`. You will need docker as this
command will start a local S3 service called [MinIO](https://hub.docker.com/r/minio/minio/).
