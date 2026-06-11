import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    console.error('--- EXCEPTION OCCURRED ---');
    console.error('Request:', request.method, request.url);
    console.error(exception);
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;
      
    const message = exception instanceof HttpException
      ? exception.getResponse()
      : (exception as any).message || exception;
      
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`HOS Backend API running on: http://localhost:${port}/api/v1`);
}
bootstrap();
