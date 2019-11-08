import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';

import Mail from '../../lib/Mail';

class AppointmentController {
    // lista agendamento
    async index(req, res) {
        /**
         * Paginação
         */
        const { page = 1 } = req.query;
        /**
         *   Listagem de Agendamentos
         */

        const appointments = await Appointment.findAll({
            where: { user_id: req.userId, canceled_at: null },
            order: ['date'],
            attributes: ['id', 'date'],
            // listagem limite de 20 em 20
            limit: 20,
            // Essa conta é simples mas bem util
            offset: (page - 1) * 20,
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'url', 'path'],
                        },
                    ],
                },
            ],
        });
        return res.json(appointments);
    }

    // cria agendamento
    async store(req, res) {
        // validação
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            date: Yup.date().required(),
        });

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ error: 'Validation fails' });
        }
        const { provider_id, date } = req.body;
        /**
         * check if provider_id is a provider
         */

        const isProvider = await User.findOne({
            where: { id: provider_id, provider: true },
        });
        if (!isProvider) {
            return res.status(401).json({
                error: 'You can only create Appointments with Providers',
            });
        }
        /**
         * Check for past dates
         */
        const hourStart = startOfHour(parseISO(date));
        if (isBefore(hourStart, new Date())) {
            return res
                .status(400)
                .json({ error: 'Past dates are note permited' });
        }
        /**
         * Check date Availability
         */
        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourStart,
            },
        });
        if (checkAvailability) {
            return res.status(400).json({
                error: 'Appointment date is not available',
            });
        }
        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            date,
        });

        /**
         * Notify appointment provider
         */

        const user = await User.findByPk(req.userId);
        const formattedDate = format(
            hourStart,
            "'dia' dd 'de' MMM', às' H:mm'h'",
            { locale: pt }
        );

        await Notification.create({
            content: `Novo agendamento de ${user.name} para ${formattedDate}`,
            user: provider_id,
        });

        return res.json(appointment);
    }

    // deleta agendamento
    async delete(req, res) {
        const appointment = await Appointment.findByPk(req.params.id, {
            // configurações de que são pegas para enviar email ao destinatário
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'email'],
                },
            ],
        });
        // Se o id do usuario for diferente do user id vai dar erro
        if (appointment.user_id !== req.userId) {
            return res.status(401).json({
                error: "You don't have permission to cancel this appointment.",
            });
        }
        // remove duas horas do agendamento
        const dateWithSub = subHours(appointment.date, 2);

        if (isBefore(dateWithSub, new Date())) {
            return res.status(401).json({
                errr: 'You can only cancel appointments 2 hours in advance.',
            });
        }
        appointment.canceled_at = new Date();

        await appointment.save();
        // Configuração de envio de email
        await Mail.sendMail({
            to: `${appointment.provider.name}  <${appointment.provider.email} >`,
            subject: 'Agendamento Cancelado',
            text: 'Você tem um novo Cancelamento',
        });
        return res.json(appointment);
    }
}
export default new AppointmentController();
