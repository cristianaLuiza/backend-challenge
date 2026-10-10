import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { WalletService } from "../aplicacoes/wallet.service";
import { CriarWalletDto } from "./wallet.dto";

@Controller('wallets')
export class WalletController{
    constructor(
        private readonly walletService: WalletService
    ){}

    @Get(':id')
    async buscarPorId(@Param('id') id:string){
        return this.walletService.buscarPorId(id);
    }

    @Post()
    async criar(@Body() dados: CriarWalletDto){
        return this.walletService.criar(dados)
    }
}